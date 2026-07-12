const PromotionController = require("./controller/PromotionController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

/**
 * @openapi
 * components:
 *   schemas:
 *     ApplicableRule:
 *       type: object
 *       required: [type]
 *       properties:
 *         type: { type: string, enum: [all, category, product] }
 *         categoryIds: { type: array, items: { type: string } }
 *         productItemIds: { type: array, items: { type: string } }
 *     Promotion:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         tenantId: { type: string }
 *         branchId: { type: string, nullable: true, description: "null = applies to all branches" }
 *         promoName: { type: string }
 *         description: { type: string }
 *         discountType: { type: string, enum: [PERCENT, FIXED_AMOUNT] }
 *         discountValue: { type: number }
 *         maxDiscountAmount: { type: number, nullable: true }
 *         minOrderValue: { type: number }
 *         applicableRule: { $ref: "#/components/schemas/ApplicableRule" }
 *         startDate: { type: string, format: date-time }
 *         endDate: { type: string, format: date-time }
 *         priority: { type: number }
 *         stackable: { type: boolean }
 *         usageLimit: { type: number, nullable: true }
 *         usageLimitPerCustomer: { type: number, nullable: true }
 *         usedCount: { type: number }
 *         status: { type: string, enum: [ACTIVE, INACTIVE] }
 *     PromotionCalculateItem:
 *       type: object
 *       required: [productItemId, quantity, unitPrice]
 *       properties:
 *         productItemId: { type: string }
 *         quantity: { type: number }
 *         unitPrice: { type: number }
 *
 * /promotions:
 *   post:
 *     tags: [Promotions]
 *     summary: Create a promotion campaign
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [promoName, discountType, discountValue, applicableRule, startDate, endDate]
 *             properties:
 *               branchId: { type: string, nullable: true }
 *               promoName: { type: string }
 *               description: { type: string }
 *               discountType: { type: string, enum: [PERCENT, FIXED_AMOUNT] }
 *               discountValue: { type: number }
 *               maxDiscountAmount: { type: number }
 *               minOrderValue: { type: number }
 *               applicableRule: { $ref: "#/components/schemas/ApplicableRule" }
 *               startDate: { type: string, format: date-time }
 *               endDate: { type: string, format: date-time }
 *               priority: { type: number }
 *               stackable: { type: boolean }
 *               usageLimit: { type: number }
 *               usageLimitPerCustomer: { type: number }
 *     responses:
 *       201:
 *         description: Promotion created successfully
 *       400:
 *         description: Validation error
 *   get:
 *     tags: [Promotions]
 *     summary: List promotions (branch/role scoped)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: recordPerPage
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE] }
 *       - in: query
 *         name: branchId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of promotions
 * /promotions/{id}:
 *   get:
 *     tags: [Promotions]
 *     summary: Get promotion detail
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Promotion detail
 *       404:
 *         description: Promotion not found
 *   patch:
 *     tags: [Promotions]
 *     summary: Update a promotion
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               promoName: { type: string }
 *               status: { type: string, enum: [ACTIVE, INACTIVE] }
 *     responses:
 *       200:
 *         description: Promotion updated
 *       400:
 *         description: Validation error
 *   delete:
 *     tags: [Promotions]
 *     summary: Deactivate a promotion (soft-delete, sets status to INACTIVE)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Promotion deactivated
 *       400:
 *         description: Promotion not found
 * /promotions/{id}/logs:
 *   get:
 *     tags: [Promotions]
 *     summary: Get usage log history for a promotion
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of promotion usage logs
 * /promotions/calculate:
 *   post:
 *     tags: [Promotions]
 *     summary: Preview eligible promotions and the stacked discount for a cart (read-only, no side effects)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               branchId: { type: string }
 *               customerId: { type: string }
 *               items:
 *                 type: array
 *                 items: { $ref: "#/components/schemas/PromotionCalculateItem" }
 *     responses:
 *       200:
 *         description: Discount breakdown
 *       400:
 *         description: Validation error
 * /promotions/apply:
 *   post:
 *     tags: [Promotions]
 *     summary: Apply eligible promotions to an order — commits usage count and writes usage logs
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items, orderId]
 *             properties:
 *               branchId: { type: string }
 *               customerId: { type: string }
 *               orderId: { type: string }
 *               items:
 *                 type: array
 *                 items: { $ref: "#/components/schemas/PromotionCalculateItem" }
 *     responses:
 *       200:
 *         description: Discount breakdown applied and logged
 *       400:
 *         description: Validation error or a promotion's usage limit was reached
 */
const registerPromotionModule = (app) => {
  const routes = [
    {
      method: "post",
      path: "/promotions",
      handler: PromotionController.create.bind(PromotionController),
      action: "create",
    },
    {
      method: "get",
      path: "/promotions",
      handler: PromotionController.getList.bind(PromotionController),
      action: "read",
    },
    {
      method: "get",
      path: "/promotions/:id",
      handler: PromotionController.getDetail.bind(PromotionController),
      action: "read",
    },
    {
      method: "patch",
      path: "/promotions/:id",
      handler: PromotionController.update.bind(PromotionController),
      action: "update",
    },
    {
      method: "delete",
      path: "/promotions/:id",
      handler: PromotionController.softDelete.bind(PromotionController),
      action: "delete",
    },
    {
      method: "get",
      path: "/promotions/:id/logs",
      handler: PromotionController.getLogs.bind(PromotionController),
      action: "read",
    },
    {
      method: "post",
      path: "/promotions/calculate",
      handler: PromotionController.calculate.bind(PromotionController),
      action: "calculate",
    },
    {
      method: "post",
      path: "/promotions/apply",
      handler: PromotionController.apply.bind(PromotionController),
      action: "apply",
    },
  ];

  routes.forEach(({ method, path, handler, action }) => {
    app[method](path, verifyJwt, authorize("promotions", action), handler);
  });
};

module.exports = { registerPromotionModule };
