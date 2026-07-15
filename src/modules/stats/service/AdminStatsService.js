const {
  Tenant,
  Subscription,
  SubscriptionInvoice,
  Ticket,
} = require("../../../models");

const TZ = "+07:00";
const PAID = "PAID";

class AdminStatsService {
  async getOverview({ fromDate, toDate, groupBy }) {
    const format = groupBy === "month" ? "%Y-%m" : "%Y-%m-%d";
    const spanMs = toDate.getTime() - fromDate.getTime();
    const prevFrom = new Date(fromDate.getTime() - spanMs - 1);
    const prevTo = new Date(fromDate.getTime() - 1);

    const paidRevenue = async (from, to) => {
      const [row] = await SubscriptionInvoice.aggregate([
        { $match: { status: PAID, paidAt: { $gte: from, $lte: to } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]);
      return { total: row?.total ?? 0, count: row?.count ?? 0 };
    };

    const [
      tenantStatusRows,
      totalTenants,
      newTenants,
      prevNewTenants,
      subStatusRows,
      planRows,
      totalRevenueRow,
      revenueInPeriod,
      revenuePrevPeriod,
      revenueSeries,
      tenantGrowth,
      ticketRows,
      sepayRow,
      topTenants,
      recentInvoices,
    ] = await Promise.all([
      Tenant.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Tenant.countDocuments({}),
      Tenant.countDocuments({ createdAt: { $gte: fromDate, $lte: toDate } }),
      Tenant.countDocuments({ createdAt: { $gte: prevFrom, $lte: prevTo } }),
      Subscription.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Subscription.aggregate([
        { $match: { status: { $in: ["TRIAL", "ACTIVE", "PAST_DUE"] } } },
        { $group: { _id: "$planId", count: { $sum: 1 } } },
        { $lookup: { from: "plans", localField: "_id", foreignField: "_id", as: "plan" } },
        { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            planId: "$_id",
            planCode: "$plan.planCode",
            planName: "$plan.planName",
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),
      SubscriptionInvoice.aggregate([
        { $match: { status: PAID } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      paidRevenue(fromDate, toDate),
      paidRevenue(prevFrom, prevTo),
      SubscriptionInvoice.aggregate([
        { $match: { status: PAID, paidAt: { $gte: fromDate, $lte: toDate } } },
        {
          $group: {
            _id: { $dateToString: { format, date: "$paidAt", timezone: TZ } },
            revenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, bucket: "$_id", revenue: 1, count: 1 } },
      ]),
      Tenant.aggregate([
        { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
        {
          $group: {
            _id: { $dateToString: { format, date: "$createdAt", timezone: TZ } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, bucket: "$_id", count: 1 } },
      ]),
      Ticket.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Tenant.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            linked: {
              $sum: {
                $cond: [
                  { $ne: [{ $ifNull: ["$banking.sepayWebhookApiKey", ""] }, ""] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      SubscriptionInvoice.aggregate([
        { $match: { status: PAID } },
        { $group: { _id: "$tenantId", revenue: { $sum: "$amount" }, invoiceCount: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $lookup: { from: "tenants", localField: "_id", foreignField: "_id", as: "tenant" } },
        { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, tenantId: "$_id", name: "$tenant.name", revenue: 1, invoiceCount: 1 } },
      ]),
      SubscriptionInvoice.find({})
        .populate("planId", "planName planCode")
        .populate("tenantId", "name")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
    ]);

    const countBy = (rows) =>
      rows.reduce((acc, r) => {
        acc[r._id] = r.count;
        return acc;
      }, {});
    const tStatus = countBy(tenantStatusRows);
    const sStatus = countBy(subStatusRows);
    const tickets = countBy(ticketRows);

    const pct = (cur, prev) =>
      prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10;

    const paying = (sStatus.ACTIVE ?? 0) + (sStatus.PAST_DUE ?? 0);
    const nonTrial = paying + (sStatus.EXPIRED ?? 0) + (sStatus.CANCELLED ?? 0);
    const conversionRate = nonTrial === 0 ? null : Math.round((paying / nonTrial) * 1000) / 10;

    const sepay = sepayRow[0] || { total: 0, linked: 0 };

    return {
      period: { fromDate, toDate },
      tenants: {
        total: totalTenants,
        active: tStatus.ACTIVE ?? 0,
        inactive: tStatus.INACTIVE ?? 0,
        suspended: tStatus.SUSPENDED ?? 0,
        newInPeriod: newTenants,
        changePct: pct(newTenants, prevNewTenants),
      },
      subscriptions: {
        byStatus: {
          TRIAL: sStatus.TRIAL ?? 0,
          ACTIVE: sStatus.ACTIVE ?? 0,
          PAST_DUE: sStatus.PAST_DUE ?? 0,
          EXPIRED: sStatus.EXPIRED ?? 0,
          CANCELLED: sStatus.CANCELLED ?? 0,
        },
        planDistribution: planRows,
        conversionRate,
      },
      revenue: {
        total: totalRevenueRow[0]?.total ?? 0,
        inPeriod: revenueInPeriod.total,
        invoiceCountInPeriod: revenueInPeriod.count,
        changePct: pct(revenueInPeriod.total, revenuePrevPeriod.total),
        groupBy: groupBy === "month" ? "month" : "day",
        series: revenueSeries,
      },
      tenantGrowth,
      tickets: {
        open: (tickets.OPEN ?? 0) + (tickets.IN_PROGRESS ?? 0),
        resolved: (tickets.RESOLVED ?? 0) + (tickets.CLOSED ?? 0),
        total: Object.values(tickets).reduce((a, b) => a + b, 0),
      },
      sepay: { linked: sepay.linked, total: sepay.total },
      topTenants,
      recentInvoices,
    };
  }
}

module.exports = new AdminStatsService();
