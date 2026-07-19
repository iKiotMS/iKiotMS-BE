const mongoose = require("mongoose");
const { Promotion, PromotionLog, ProductItem, Product, Branch, Order } = require("../../../models");
const PricingEngine = require("./PricingEngine");

function round(amount) {
  return Math.round(amount);
}

class PromotionService {
  // Batch-validate — every id in branchIds must resolve to a branch in this tenant.
  async _validateBranches(tenantId, branchIds) {
    const branches = await Branch.find({ _id: { $in: branchIds }, tenantId })
      .select("_id")
      .lean();
    if (branches.length !== new Set(branchIds.map(String)).size) {
      throw new Error("Branch not found");
    }
  }

  // TENANT_OWNER/SUPER_ADMIN see everything (optionally filtered by a requested branch).
  // BRANCH_MANAGER/STAFF only see tenant-wide promotions plus ones scoped to their own branch.
  _branchScope(user, requestedBranchId) {
    if (user.role === "BRANCH_MANAGER" || user.role === "STAFF") {
      return {
        $or: [
          { branchIds: { $exists: false } },
          { branchIds: { $size: 0 } },
          { branchIds: user.branchId },
        ],
      };
    }
    return requestedBranchId ? { branchIds: requestedBranchId } : {};
  }

  // Single-document counterpart of _branchScope, for endpoints that fetch by id
  // (getPromotionById/getPromotionLogs) rather than filtering a list.
  _assertBranchAccess(user, promotion) {
    if (user.role !== "BRANCH_MANAGER" && user.role !== "STAFF") return;
    const branchIds = promotion.branchIds || [];
    if (branchIds.length === 0) return;
    const inScope = branchIds.some((id) => String(id) === String(user.branchId));
    if (!inScope) {
      const error = new Error("Promotion access denied");
      error.statusCode = 403;
      throw error;
    }
  }

  async createPromotion(tenantId, data, user) {
    // BRANCH_MANAGER may only ever scope a promotion to their own branch — force it
    // server-side regardless of what was submitted (empty/other branchIds included).
    if (user && user.role === "BRANCH_MANAGER") {
      data.branchIds = [user.branchId];
    }

    if (data.branchIds && data.branchIds.length > 0) {
      await this._validateBranches(tenantId, data.branchIds);
    }
    if (new Date(data.endDate) <= new Date(data.startDate)) {
      throw new Error("End date must be after start date");
    }

    const promotion = new Promotion({
      ...data,
      tenantId,
      usedCount: 0,
    });
    await promotion.save();
    return promotion;
  }

  async listPromotions(tenantId, user, query) {
    const { page = 1, recordPerPage = 10, status, search, branchId } = query;
    const skip = (page - 1) * recordPerPage;

    const filter = { tenantId, ...this._branchScope(user, branchId) };
    if (status) filter.status = status;
    if (search) filter.promoName = { $regex: search, $options: "i" };

    const [data, total] = await Promise.all([
      Promotion.find(filter)
        .skip(skip)
        .limit(Number(recordPerPage))
        .sort({ createdAt: -1 })
        .lean(),
      Promotion.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(recordPerPage),
        totalPages: Math.ceil(total / recordPerPage),
      },
    };
  }

  async getPromotionById(tenantId, id, user) {
    const promotion = await Promotion.findOne({ _id: id, tenantId }).lean();
    if (!promotion) {
      const error = new Error("Promotion not found");
      error.statusCode = 404;
      throw error;
    }
    this._assertBranchAccess(user, promotion);
    return promotion;
  }

  async updatePromotion(tenantId, id, updateData, user) {
    // usedCount is server-managed only, mirrors Supplier.outstandingDebt protection.
    if (updateData.usedCount !== undefined) {
      delete updateData.usedCount;
    }

    const existing = await Promotion.findOne({ _id: id, tenantId }).lean();
    if (!existing) {
      throw new Error("Promotion not found");
    }
    // A branch manager may only ever touch promotions already in their scope, and
    // any branchIds they submit gets forced back to their own branch (same rule as create).
    if (user && user.role === "BRANCH_MANAGER") {
      this._assertBranchAccess(user, existing);
      if (updateData.branchIds) {
        updateData.branchIds = [user.branchId];
      }
    }

    if (updateData.branchIds && updateData.branchIds.length > 0) {
      await this._validateBranches(tenantId, updateData.branchIds);
    }

    const startDate = updateData.startDate ?? existing.startDate;
    const endDate = updateData.endDate ?? existing.endDate;
    if (new Date(endDate) <= new Date(startDate)) {
      throw new Error("End date must be after start date");
    }

    const promotion = await Promotion.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updateData },
      { new: true, runValidators: true },
    );
    return promotion;
  }

  async softDeletePromotion(tenantId, id) {
    const promotion = await Promotion.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { status: "INACTIVE" } },
      { new: true },
    );
    if (!promotion) {
      throw new Error("Promotion not found");
    }
    return promotion;
  }

  // Resolves productItemId -> categoryId (ProductItem doesn't carry categoryId directly)
  // and computes each line's total, producing the cartContext PricingEngine expects.
  async _buildCartContext(tenantId, { branchId, customerId, items }) {
    const productItemIds = items.map((item) => item.productItemId);
    const productItems = await ProductItem.find({
      tenantId,
      _id: { $in: productItemIds },
    })
      .select("productId")
      .lean();
    const itemIdToProductId = new Map(
      productItems.map((pi) => [String(pi._id), pi.productId]),
    );

    const productIds = productItems.map((pi) => pi.productId);
    const products = await Product.find({ tenantId, _id: { $in: productIds } })
      .select("categoryId")
      .lean();
    const productIdToCategoryId = new Map(
      products.map((p) => [String(p._id), p.categoryId]),
    );

    const cartItems = items.map((item) => {
      const productId = itemIdToProductId.get(String(item.productItemId));
      const categoryId = productId
        ? productIdToCategoryId.get(String(productId))
        : null;
      return {
        productItemId: item.productItemId,
        categoryId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: round(item.quantity * item.unitPrice),
      };
    });

    const subtotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
    return {
      branchId: branchId || null,
      customerId: customerId || null,
      subtotal,
      items: cartItems,
    };
  }

  async _findCandidatePromotions(tenantId, branchId) {
    const now = new Date();
    return Promotion.find({
      tenantId,
      status: "ACTIVE",
      startDate: { $lte: now },
      endDate: { $gte: now },
      // $size:0 only matches an array field that's actually present — a promotion
      // predating the branchIds field (no default applied at insert time) would have
      // no branchIds key at all and silently never match either clause, so treat a
      // missing field the same as tenant-wide too.
      $or: [
        { branchIds: { $exists: false } },
        { branchIds: { $size: 0 } },
        { branchIds: branchId },
      ],
    }).lean();
  }

  // How many times this customer has already used each candidate promotion (only the
  // ones that actually cap usage per customer) — PricingEngine stays DB-free, so this
  // is fetched here and passed in as a plain { [promotionId]: count } map.
  async _getCustomerUsageCounts(tenantId, customerId, promotions) {
    const relevantIds = promotions
      .filter((p) => p.usageLimitPerCustomer != null)
      .map((p) => p._id);
    if (!customerId || relevantIds.length === 0) return {};

    const rows = await PromotionLog.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          customerId: new mongoose.Types.ObjectId(customerId),
          promotionId: { $in: relevantIds },
        },
      },
      { $group: { _id: "$promotionId", count: { $sum: 1 } } },
    ]);

    const counts = {};
    for (const row of rows) counts[String(row._id)] = row.count;
    return counts;
  }

  // Shared by calculateDiscount/applyPromotions/listCandidatePromotions: builds the
  // cart context, fetches this tenant+branch's candidate promotions, and pre-fetches
  // per-customer usage counts — one place instead of three copies of this sequence.
  async _resolveForPayload(tenantId, payload) {
    const cartContext = await this._buildCartContext(tenantId, payload);
    const candidates = await this._findCandidatePromotions(tenantId, cartContext.branchId);
    const customerUsageCounts = await this._getCustomerUsageCounts(
      tenantId,
      cartContext.customerId,
      candidates,
    );
    return { cartContext, candidates, customerUsageCounts };
  }

  // Browse endpoint: every candidate promotion for this cart, split branch-specific
  // vs tenant-wide, each annotated with eligibility + a standalone preview discount —
  // powers the "assign discount" picker instead of an auto-applied result.
  async listCandidatePromotions(tenantId, payload) {
    const { cartContext, candidates, customerUsageCounts } = await this._resolveForPayload(
      tenantId,
      payload,
    );
    const now = new Date();
    const built = PricingEngine.buildCandidateList(candidates, cartContext, now, customerUsageCounts);

    const toResponseShape = (entry) => ({
      id: entry.promotion._id,
      promoName: entry.promotion.promoName,
      description: entry.promotion.description,
      discountType: entry.promotion.discountType,
      discountValue: entry.promotion.discountValue,
      maxDiscountAmount: entry.promotion.maxDiscountAmount,
      minOrderValue: entry.promotion.minOrderValue,
      branchIds: entry.promotion.branchIds,
      stackable: entry.promotion.stackable,
      eligible: entry.eligible,
      reason: entry.reason,
      previewDiscount: entry.previewDiscount,
    });

    const sortEntries = (a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.previewDiscount - a.previewDiscount;
    };

    const branchPromotions = built
      .filter((entry) => entry.promotion.branchIds && entry.promotion.branchIds.length > 0)
      .sort(sortEntries)
      .map(toResponseShape);
    const systemPromotions = built
      .filter((entry) => !entry.promotion.branchIds || entry.promotion.branchIds.length === 0)
      .sort(sortEntries)
      .map(toResponseShape);

    return { branchPromotions, systemPromotions };
  }

  // Read-only preview — no session, no log, no usedCount mutation.
  async calculateDiscount(tenantId, payload) {
    const { cartContext, candidates, customerUsageCounts } = await this._resolveForPayload(
      tenantId,
      payload,
    );
    return PricingEngine.resolveSelectedPromotions(
      candidates,
      payload.promotionIds,
      cartContext,
      new Date(),
      customerUsageCounts,
    );
  }

  // Commits: re-validates usage caps atomically inside a transaction, increments
  // usedCount, and writes one PromotionLog per applied promotion.
  async applyPromotions(tenantId, payload) {
    const { orderId, userId } = payload;
    if (!orderId) {
      throw new Error("orderId is required to apply promotions");
    }

    const { cartContext, candidates, customerUsageCounts } = await this._resolveForPayload(
      tenantId,
      payload,
    );
    const result = PricingEngine.resolveSelectedPromotions(
      candidates,
      payload.promotionIds,
      cartContext,
      new Date(),
      customerUsageCounts,
    );

    if (result.appliedPromotions.length === 0) {
      return result;
    }

    const candidateById = new Map(candidates.map((p) => [String(p._id), p]));

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (const applied of result.appliedPromotions) {
        // Atomic guard: only increments if usage cap isn't already exhausted —
        // safer than read-then-write under concurrent checkouts.
        const updated = await Promotion.findOneAndUpdate(
          {
            _id: applied.promotionId,
            tenantId,
            $or: [
              { usageLimit: null },
              { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
            ],
          },
          { $inc: { usedCount: 1 } },
          { session, new: true },
        );
        if (!updated) {
          throw new Error(`Promotion "${applied.promoName}" has reached its usage limit`);
        }

        // Re-check the per-customer cap inside the transaction — the count fetched
        // before this transaction started could be stale under concurrent checkouts
        // by the same customer (e.g. two tabs applying the same promotion at once).
        const candidate = candidateById.get(String(applied.promotionId));
        if (candidate?.usageLimitPerCustomer != null && cartContext.customerId) {
          const usedByCustomer = await PromotionLog.countDocuments({
            tenantId,
            promotionId: applied.promotionId,
            customerId: cartContext.customerId,
          }).session(session);
          if (usedByCustomer >= candidate.usageLimitPerCustomer) {
            throw new Error(
              `Promotion "${applied.promoName}" has reached its usage limit for this customer`,
            );
          }
        }

        const log = new PromotionLog({
          tenantId,
          promotionId: applied.promotionId,
          orderId,
          branchId: cartContext.branchId,
          customerId: cartContext.customerId,
          discountAmount: applied.discountAmount,
          createdBy: userId,
          description: `Áp dụng khuyến mãi "${applied.promoName}" cho đơn hàng`,
        });
        await log.save({ session });
      }

      await session.commitTransaction();
      session.endSession();
      return result;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async getPromotionLogs(tenantId, promotionId, query, user) {
    const promotion = await Promotion.findOne({ _id: promotionId, tenantId })
      .select("branchIds")
      .lean();
    if (!promotion) {
      const error = new Error("Promotion not found");
      error.statusCode = 404;
      throw error;
    }
    this._assertBranchAccess(user, promotion);

    const { page = 1, recordPerPage = 10 } = query;
    const skip = (page - 1) * recordPerPage;
    const filter = { tenantId, promotionId };

    const [logs, total] = await Promise.all([
      PromotionLog.find(filter)
        .skip(skip)
        .limit(Number(recordPerPage))
        .sort({ createdAt: -1 })
        .lean(),
      PromotionLog.countDocuments(filter),
    ]);

    const orderIds = [...new Set(logs.filter((log) => log.orderId).map((log) => log.orderId.toString()))];
    const orders = orderIds.length
      ? await Order.find({ _id: { $in: orderIds } })
          .select("paymentReference")
          .lean()
      : [];
    const paymentReferenceById = new Map(orders.map((order) => [order._id.toString(), order.paymentReference]));

    const data = logs.map((log) => {
      const orderId = log.orderId ? log.orderId.toString() : null;
      const paymentReference = orderId ? paymentReferenceById.get(orderId) || null : null;
      return { ...log, paymentReference };
    });

    return {
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(recordPerPage),
        totalPages: Math.ceil(total / recordPerPage),
      },
    };
  }
}

module.exports = new PromotionService();
