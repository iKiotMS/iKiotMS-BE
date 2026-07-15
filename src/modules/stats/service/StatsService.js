const mongoose = require("mongoose");
const { Order, CashFlow, Inventory } = require("../../../models");
const { referenceMatcher } = require("../../../utils/referenceGenerator");

const REVENUE_STATUS = "COMPLETED";


const TZ = "+07:00";

const toObjectId = (id) => {
  if (id instanceof mongoose.Types.ObjectId) return id;
  return mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : id;
};

class StatsService {
  _branchFilter(user, requestedBranchId) {
    if (user.role === "BRANCH_MANAGER") {
      if (!user.branchId) throw new Error("Branch manager has no branch assigned");
      return { branchId: toObjectId(user.branchId) };
    }
    if (user.role === "WAREHOUSE_MANAGER") {
      return { branchId: null };
    }
    return requestedBranchId ? { branchId: toObjectId(requestedBranchId) } : {};
  }

  _dateRange(fromDate, toDate) {
    return { $gte: fromDate, $lte: toDate };
  }

  async getOverview(user, { fromDate, toDate, branchId }) {
    const scope = this._branchFilter(user, branchId);
    const spanMs = toDate.getTime() - fromDate.getTime();
    const prevFrom = new Date(fromDate.getTime() - spanMs - 1);
    const prevTo = new Date(fromDate.getTime() - 1);

    const summarize = async (from, to) => {
      const [row] = await Order.aggregate([
        { $match: { tenantId: toObjectId(user.tenantId), status: REVENUE_STATUS, ...scope, createdAt: this._dateRange(from, to) } },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$grandTotal" },
            orderCount: { $sum: 1 },
            customers: { $addToSet: "$customerId" },
          },
        },
      ]);
      const revenue = row?.revenue ?? 0;
      const orderCount = row?.orderCount ?? 0;
      return {
        revenue,
        orderCount,
        customerCount: row?.customers?.length ?? 0,
        aov: orderCount ? Math.round(revenue / orderCount) : 0,
      };
    };

    const [current, previous] = await Promise.all([
      summarize(fromDate, toDate),
      summarize(prevFrom, prevTo),
    ]);

    const pct = (cur, prev) => (prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10);

    return {
      ...current,
      changePct: {
        revenue: pct(current.revenue, previous.revenue),
        orderCount: pct(current.orderCount, previous.orderCount),
        customerCount: pct(current.customerCount, previous.customerCount),
        aov: pct(current.aov, previous.aov),
      },
      period: { fromDate, toDate },
      previousPeriod: { fromDate: prevFrom, toDate: prevTo },
    };
  }

  async getRevenueSeries(user, { fromDate, toDate, branchId, groupBy }) {
    const scope = this._branchFilter(user, branchId);
    const format = groupBy === "month" ? "%Y-%m" : "%Y-%m-%d";

    const rows = await Order.aggregate([
      { $match: { tenantId: toObjectId(user.tenantId), status: REVENUE_STATUS, ...scope, createdAt: this._dateRange(fromDate, toDate) } },
      {
        $group: {
          _id: { $dateToString: { format, date: "$createdAt", timezone: TZ } },
          revenue: { $sum: "$grandTotal" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, bucket: "$_id", revenue: 1, orderCount: 1 } },
    ]);

    return { groupBy: groupBy === "month" ? "month" : "day", series: rows };
  }

  async getRevenueByPaymentMethod(user, { fromDate, toDate, branchId }) {
    const scope = this._branchFilter(user, branchId);
    const rows = await Order.aggregate([
      { $match: { tenantId: toObjectId(user.tenantId), status: REVENUE_STATUS, ...scope, createdAt: this._dateRange(fromDate, toDate) } },
      { $group: { _id: "$paymentMethod", revenue: { $sum: "$grandTotal" }, orderCount: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $project: { _id: 0, paymentMethod: "$_id", revenue: 1, orderCount: 1 } },
    ]);
    return { breakdown: rows };
  }

  async getCashflow(user, { fromDate, toDate, branchId, flow, flowType }) {
    const scope = this._branchFilter(user, branchId);
    const match = {
      tenantId: toObjectId(user.tenantId),
      ...scope,
      createdAt: this._dateRange(fromDate, toDate),
    };
    if (flowType) match.flowType = flowType;
    if (flow) match.paymentReference = referenceMatcher(flow);

    const rows = await CashFlow.aggregate([
      { $match: match },
      { $group: { _id: "$flowType", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const income = rows.find((r) => r._id === "INCOME")?.total ?? 0;
    const expense = rows.find((r) => r._id === "EXPENSE")?.total ?? 0;
    return {
      income,
      expense,
      net: income - expense,
      byType: rows.map((r) => ({ flowType: r._id, total: r.total, count: r.count })),
    };
  }

  async getCashflowList(user, { fromDate, toDate, branchId, flow, flowType, paymentMethod, page, limit }) {
    const scope = this._branchFilter(user, branchId);
    const match = {
      tenantId: toObjectId(user.tenantId),
      ...scope,
      createdAt: this._dateRange(fromDate, toDate),
    };
    if (flowType) match.flowType = flowType;
    if (paymentMethod) match.paymentMethod = paymentMethod;
    if (flow) match.paymentReference = referenceMatcher(flow);

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      CashFlow.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("branchId", "name")
        .populate("supplierId", "name")
        .populate("createdBy", "profile.firstName profile.lastName")
        .lean(),
      CashFlow.countDocuments(match),
    ]);

    const fullName = (u) => {
      if (!u?.profile) return null;
      const name = `${u.profile.firstName || ""} ${u.profile.lastName || ""}`.trim();
      return name || null;
    };

    const data = items.map((c) => ({
      _id: c._id,
      flowType: c.flowType,
      amount: c.amount,
      paymentMethod: c.paymentMethod || null,
      description: c.description || null,
      paymentReference: c.paymentReference || null,
      branchName: c.branchId?.name || null,
      supplierName: c.supplierId?.name || null,
      createdByName: fullName(c.createdBy),
      orderId: c.orderId || null,
      createdAt: c.createdAt,
    }));

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getRevenueByStaff(user, { fromDate, toDate, branchId }) {
    const scope = this._branchFilter(user, branchId);
    const rows = await Order.aggregate([
      { $match: { tenantId: toObjectId(user.tenantId), status: REVENUE_STATUS, ...scope, createdAt: this._dateRange(fromDate, toDate) } },
      { $group: { _id: "$userId", revenue: { $sum: "$grandTotal" }, orderCount: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "staff" } },
      {
        $project: {
          _id: 0,
          userId: "$_id",

          staffName: {
            $let: {
              vars: { s: { $arrayElemAt: ["$staff", 0] } },
              in: {
                $let: {
                  vars: {
                    full: {
                      $trim: {
                        input: {
                          $concat: [
                            { $ifNull: ["$$s.profile.firstName", ""] },
                            " ",
                            { $ifNull: ["$$s.profile.lastName", ""] },
                          ],
                        },
                      },
                    },
                  },
                  in: { $cond: [{ $eq: ["$$full", ""] }, null, "$$full"] },
                },
              },
            },
          },
          revenue: 1,
          orderCount: 1,
          aov: {
            $cond: [{ $eq: ["$orderCount", 0] }, 0, { $round: [{ $divide: ["$revenue", "$orderCount"] }, 0] }],
          },
        },
      },
    ]);
    return { staff: rows };
  }

  async getTopProducts(user, { fromDate, toDate, branchId, sortBy, limit }) {
    const scope = this._branchFilter(user, branchId);
    const sortField = sortBy === "revenue" ? "revenue" : "quantity";

    const rows = await Order.aggregate([
      { $match: { tenantId: toObjectId(user.tenantId), status: REVENUE_STATUS, ...scope, createdAt: this._dateRange(fromDate, toDate) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productItemId",
          productName: { $first: "$items.productName" },
          quantity: { $sum: "$items.quantity" },
          revenue: {
            $sum: {
              $subtract: [
                { $multiply: ["$items.unitPrice", "$items.quantity"] },
                { $ifNull: ["$items.discountAmount", 0] },
              ],
            },
          },
        },
      },
      { $sort: { [sortField]: -1 } },
      { $limit: limit },
      { $project: { _id: 0, productItemId: "$_id", productName: 1, quantity: 1, revenue: 1 } },
    ]);
    return { sortBy: sortField, products: rows };
  }

  async getInventory(user, { branchId, lowStockThreshold }) {
    const match = { tenantId: toObjectId(user.tenantId) };
    if (user.role === "WAREHOUSE_MANAGER") {
      if (!user.warehouseId) throw new Error("Warehouse manager has no warehouse assigned");
      match.locationId = toObjectId(user.warehouseId);
      match.locationType = "warehouse";
    } else if (user.role === "BRANCH_MANAGER") {
      if (!user.branchId) throw new Error("Branch manager has no branch assigned");
      match.locationId = toObjectId(user.branchId);
      match.locationType = "branch";
    } else if (branchId) {
      match.locationId = toObjectId(branchId);
    }

    const [result] = await Inventory.aggregate([
      { $match: match },
      { $lookup: { from: "productitems", localField: "productItemId", foreignField: "_id", as: "item" } },
      { $unwind: "$item" },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                stockValue: { $sum: { $multiply: ["$stock", { $ifNull: ["$item.costPrice", 0] }] } },
                totalUnits: { $sum: "$stock" },
                skuCount: { $sum: 1 },
                outOfStock: { $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] } },
              },
            },
          ],
          lowStock: [
            { $match: { stock: { $lte: lowStockThreshold } } },
            { $sort: { stock: 1 } },
            { $limit: 100 },
            {
              $project: {
                _id: 0,
                productItemId: "$productItemId",
                productName: "$item.productName",
                sku: "$item.sku",
                locationId: "$locationId",
                locationType: "$locationType",
                stock: "$stock",
              },
            },
          ],
        },
      },
    ]);

    const totals = result?.totals?.[0];
    return {
      stockValue: totals?.stockValue ?? 0,
      totalUnits: totals?.totalUnits ?? 0,
      skuCount: totals?.skuCount ?? 0,
      outOfStock: totals?.outOfStock ?? 0,
      lowStockThreshold,
      lowStock: result?.lowStock ?? [],
    };
  }
}

module.exports = new StatsService();
