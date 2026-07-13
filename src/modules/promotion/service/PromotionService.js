const mongoose = require("mongoose");
const { Promotion, PromotionLog, ProductItem, Product, Branch, Order } = require("../../../models");
const PricingEngine = require("./PricingEngine");

function round(amount) {
  return Math.round(amount);
}

class PromotionService {
  async _validateBranch(tenantId, branchId) {
    const branch = await Branch.findOne({ _id: branchId, tenantId }).lean();
    if (!branch) {
      throw new Error("Branch not found");
    }
  }

  // TENANT_OWNER/SUPER_ADMIN see everything (optionally filtered by a requested branch).
  // BRANCH_MANAGER/STAFF only see tenant-wide promotions plus ones scoped to their own branch.
  _branchScope(user, requestedBranchId) {
    if (user.role === "BRANCH_MANAGER" || user.role === "STAFF") {
      return { $or: [{ branchId: null }, { branchId: user.branchId }] };
    }
    return requestedBranchId ? { branchId: requestedBranchId } : {};
  }

  async createPromotion(tenantId, data) {
    if (data.branchId) {
      await this._validateBranch(tenantId, data.branchId);
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

  async getPromotionById(tenantId, id) {
    const promotion = await Promotion.findOne({ _id: id, tenantId }).lean();
    if (!promotion) {
      throw new Error("Promotion not found");
    }
    return promotion;
  }

  async updatePromotion(tenantId, id, updateData) {
    // usedCount is server-managed only, mirrors Supplier.outstandingDebt protection.
    if (updateData.usedCount !== undefined) {
      delete updateData.usedCount;
    }
    if (updateData.branchId) {
      await this._validateBranch(tenantId, updateData.branchId);
    }

    const existing = await Promotion.findOne({ _id: id, tenantId }).lean();
    if (!existing) {
      throw new Error("Promotion not found");
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
      $or: [{ branchId: null }, { branchId }],
    }).lean();
  }

  // Read-only preview — no session, no log, no usedCount mutation.
  async calculateDiscount(tenantId, payload) {
    const cartContext = await this._buildCartContext(tenantId, payload);
    const candidates = await this._findCandidatePromotions(tenantId, cartContext.branchId);
    const applicable = PricingEngine.filterApplicablePromotions(candidates, cartContext);
    return PricingEngine.resolveStackedDiscount(applicable, cartContext);
  }

  // Commits: re-validates usage caps atomically inside a transaction, increments
  // usedCount, and writes one PromotionLog per applied promotion.
  async applyPromotions(tenantId, payload) {
    const { orderId, userId } = payload;
    if (!orderId) {
      throw new Error("orderId is required to apply promotions");
    }

    const cartContext = await this._buildCartContext(tenantId, payload);
    const candidates = await this._findCandidatePromotions(tenantId, cartContext.branchId);
    const applicable = PricingEngine.filterApplicablePromotions(candidates, cartContext);
    const result = PricingEngine.resolveStackedDiscount(applicable, cartContext);

    if (result.appliedPromotions.length === 0) {
      return result;
    }

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

  async getPromotionLogs(tenantId, promotionId, query) {
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
