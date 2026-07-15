const StatsController = require("./controller/StatsController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

/**
 * @openapi
 * tags:
 *   - name: Stats
 *     description: |
 *       Dashboard analytics. Every endpoint is scoped by the caller's role:
 *       TENANT_OWNER sees the whole tenant (optional `branchId` filter), BRANCH_MANAGER
 *       is locked to their branch, WAREHOUSE_MANAGER sees only their warehouse's
 *       inventory. Requires the `reports:read` permission.
 * components:
 *   parameters:
 *     StatsFromDate:
 *       in: query
 *       name: fromDate
 *       schema: { type: string, format: date-time }
 *       description: Start of range (inclusive). Defaults to 30 days before toDate.
 *     StatsToDate:
 *       in: query
 *       name: toDate
 *       schema: { type: string, format: date-time }
 *       description: End of range (inclusive). Defaults to now.
 *     StatsBranchId:
 *       in: query
 *       name: branchId
 *       schema: { type: string }
 *       description: Optional branch filter (TENANT_OWNER only; ignored for managers).
 *     StatsWarehouseId:
 *       in: query
 *       name: warehouseId
 *       schema: { type: string }
 *       description: Optional warehouse filter for cashflow endpoints (TENANT_OWNER only; ignored for managers). Takes precedence over branchId when both are given.
 * /stats/overview:
 *   get:
 *     tags: [Stats]
 *     summary: Headline KPIs with period-over-period change
 *     description: Revenue, order count, AOV and unique customers over the range, each with `%` change vs the immediately preceding equal-length period. Revenue counts COMPLETED orders only.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/StatsFromDate'
 *       - $ref: '#/components/parameters/StatsToDate'
 *       - $ref: '#/components/parameters/StatsBranchId'
 *     responses:
 *       200: { description: KPI summary }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 * /stats/revenue:
 *   get:
 *     tags: [Stats]
 *     summary: Revenue time series
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/StatsFromDate'
 *       - $ref: '#/components/parameters/StatsToDate'
 *       - $ref: '#/components/parameters/StatsBranchId'
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, month], default: day }
 *     responses:
 *       200: { description: 'Series of bucket / revenue / orderCount points' }
 *       400: { description: Validation error }
 * /stats/revenue-by-payment-method:
 *   get:
 *     tags: [Stats]
 *     summary: Revenue split by payment method
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/StatsFromDate'
 *       - $ref: '#/components/parameters/StatsToDate'
 *       - $ref: '#/components/parameters/StatsBranchId'
 *     responses:
 *       200: { description: Breakdown per CASH / SEPAY / ... }
 * /stats/revenue-by-staff:
 *   get:
 *     tags: [Stats]
 *     summary: Revenue attributed to each staff member
 *     description: COMPLETED orders grouped by the staff who created them, with revenue, order count and AOV. Sorted by revenue descending.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/StatsFromDate'
 *       - $ref: '#/components/parameters/StatsToDate'
 *       - $ref: '#/components/parameters/StatsBranchId'
 *     responses:
 *       200: { description: Per-staff revenue ranking }
 *       400: { description: Validation error }
 * /stats/cashflow:
 *   get:
 *     tags: [Stats]
 *     summary: Income vs expense from CashFlow
 *     description: Totals of INCOME and EXPENSE plus net. Filter by `flow` (reference prefix) to isolate a money-flow — ORD = sales, SUP = supplier payments, PAYR = payroll payments.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/StatsFromDate'
 *       - $ref: '#/components/parameters/StatsToDate'
 *       - $ref: '#/components/parameters/StatsBranchId'
 *       - $ref: '#/components/parameters/StatsWarehouseId'
 *       - in: query
 *         name: flow
 *         schema: { type: string, enum: [ORD, SUP, PAYR] }
 *         description: Reference prefix — ORD (sales), SUP (supplier payments), PAYR (payroll expenses).
 *       - in: query
 *         name: flowType
 *         schema: { type: string, enum: [INCOME, EXPENSE] }
 *     responses:
 *       200: { description: '{ income, expense, net, byType }' }
 *       400: { description: Validation error }
 * /stats/cashflow/transactions:
 *   get:
 *     tags: [Stats]
 *     summary: Paginated list of individual cash-in / cash-out transactions
 *     description: Each CashFlow record (INCOME or EXPENSE) with amount, payment method, reference, branch, supplier, creator and timestamp. Filter by `flowType`, `paymentMethod`, and `flow` (reference prefix). Scoped by role like the other stats endpoints.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/StatsFromDate'
 *       - $ref: '#/components/parameters/StatsToDate'
 *       - $ref: '#/components/parameters/StatsBranchId'
 *       - $ref: '#/components/parameters/StatsWarehouseId'
 *       - in: query
 *         name: flow
 *         schema: { type: string, enum: [ORD, SUP, PAYR] }
 *         description: Reference prefix — ORD (sales), SUP (supplier payments), PAYR (payroll expenses).
 *       - in: query
 *         name: flowType
 *         schema: { type: string, enum: [INCOME, EXPENSE] }
 *       - in: query
 *         name: paymentMethod
 *         schema: { type: string, enum: [CASH, BANK_TRANSFER, MOMO, VNPAY, SEPAY] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200: { description: '{ data: [...], pagination: { total, page, limit, totalPages } }' }
 *       400: { description: Validation error }
 * /stats/top-products:
 *   get:
 *     tags: [Stats]
 *     summary: Best-selling products
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/StatsFromDate'
 *       - $ref: '#/components/parameters/StatsToDate'
 *       - $ref: '#/components/parameters/StatsBranchId'
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [quantity, revenue], default: quantity }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200: { description: Ranked products }
 * /stats/inventory:
 *   get:
 *     tags: [Stats]
 *     summary: Inventory valuation and low-stock list
 *     description: Total stock value (stock × costPrice), unit/SKU counts, out-of-stock count, and items at or below the low-stock threshold. Scoped to the caller's location.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/StatsBranchId'
 *       - $ref: '#/components/parameters/StatsWarehouseId'
 *       - in: query
 *         name: lowStockThreshold
 *         schema: { type: integer, minimum: 0, default: 10 }
 *     responses:
 *       200: { description: Valuation + low-stock items }
 * /stats/admin/overview:
 *   get:
 *     tags: [Stats]
 *     summary: Platform-operator overview (SUPER_ADMIN only)
 *     description: Cross-tenant analytics for the platform operator — tenant counts by status, subscription plan distribution, platform revenue (from tenant plan invoices) with period-over-period change and a time series, tenant growth, ticket counts, SePay-linked ratio, top tenants by revenue, and recent invoices.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/StatsFromDate'
 *       - $ref: '#/components/parameters/StatsToDate'
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, month], default: day }
 *     responses:
 *       200: { description: Platform overview }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (not SUPER_ADMIN) }
 */
const registerStatsModule = (app) => {
  const guard = [verifyJwt, authorize("reports", "read")];

  app.get("/stats/overview", ...guard, StatsController.overview);
  app.get("/stats/revenue", ...guard, StatsController.revenue);
  app.get("/stats/revenue-by-payment-method", ...guard, StatsController.revenueByPaymentMethod);
  app.get("/stats/revenue-by-staff", ...guard, StatsController.revenueByStaff);
  app.get("/stats/cashflow", ...guard, StatsController.cashflow);
  app.get("/stats/cashflow/transactions", ...guard, StatsController.cashflowList);
  app.get("/stats/top-products", ...guard, StatsController.topProducts);
  app.get("/stats/inventory", ...guard, StatsController.inventory);

  // SUPER_ADMIN platform overview — role checked inside the controller.
  app.get("/stats/admin/overview", verifyJwt, StatsController.adminOverview);

  console.log("✓ Stats module registered");
};

module.exports = { registerStatsModule };
