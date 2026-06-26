const OrderController = require("./controller/OrderController");
const CustomerController = require("./controller/CustomerController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

/**
 * @openapi
 * /orders:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Create a new order
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - branchId
 *               - paymentMethod
 *               - items
 *               - grandTotal
 *             properties:
 *               customerId:
 *                 type: string
 *               branchId:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, BANK_TRANSFER, MOMO, VNPAY, SEPAY]
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productItemId, quantity, unitPrice]
 *                   properties:
 *                     productItemId:
 *                       type: string
 *                     productName:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                     unitPrice:
 *                       type: number
 *                       minimum: 0
 *                     discountAmount:
 *                       type: number
 *                       minimum: 0
 *               grandTotal:
 *                 type: number
 *                 minimum: 0
 *               customerPay:
 *                 type: number
 *                 minimum: 0
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order created. Returns qrUrl for SEPAY payment method.
 *       400:
 *         description: Validation error or insufficient stock
 *       401:
 *         description: Unauthorized
 *   get:
 *     tags:
 *       - Orders
 *     summary: List orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, COMPLETED, CANCELLED, RETURNED] }
 *       - in: query
 *         name: paymentMethod
 *         schema: { type: string, enum: [CASH, BANK_TRANSFER, MOMO, VNPAY, SEPAY] }
 *       - in: query
 *         name: branchId
 *         schema: { type: string }
 *       - in: query
 *         name: customerId
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by customer name or phone
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Paginated list of orders
 *       401:
 *         description: Unauthorized
 * /orders/{id}:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Get order details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 * /orders/{id}/status:
 *   patch:
 *     tags:
 *       - Orders
 *     summary: Update order status
 *     description: |
 *       Valid transitions:
 *       - PENDING → COMPLETED (manual finalize, creates CashFlow)
 *       - PENDING → CANCELLED (restores inventory)
 *       - COMPLETED → RETURNED (restores inventory, creates EXPENSE CashFlow)
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [COMPLETED, CANCELLED, RETURNED]
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status transition
 *       404:
 *         description: Order not found
 * /webhook/sepay/order:
 *   post:
 *     tags:
 *       - Webhook
 *     summary: SePay order payment webhook
 *     description: Called by SePay when a bank transfer hits a tenant's account. Marks the matching PENDING SEPAY order as COMPLETED.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               content:
 *                 type: string
 *                 description: Transfer note — must contain the order reference (e.g. ORD1A2B3C)
 *               transferType:
 *                 type: string
 *                 enum: [in, out]
 *               transferAmount:
 *                 type: number
 *               referenceCode:
 *                 type: string
 *               apiKey:
 *                 type: string
 *                 description: Tenant's SePay webhook API key
 *     responses:
 *       200:
 *         description: Webhook processed
 * /customers:
 *   post:
 *     tags:
 *       - Customers
 *     summary: Create a customer
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, OTHER]
 *               address:
 *                 type: string
 *               dob:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Customer created
 *       400:
 *         description: Validation error
 *   get:
 *     tags:
 *       - Customers
 *     summary: List customers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name or phone
 *     responses:
 *       200:
 *         description: Paginated list of customers
 * /customers/{id}:
 *   get:
 *     tags:
 *       - Customers
 *     summary: Get customer details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Customer details
 *       404:
 *         description: Customer not found
 *   patch:
 *     tags:
 *       - Customers
 *     summary: Update customer
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
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, OTHER]
 *               address:
 *                 type: string
 *               dob:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Customer updated
 *       404:
 *         description: Customer not found
 */
const registerOrderModule = (app) => {
  // Order routes
  app.post("/orders", verifyJwt, authorize("orders", "create"), OrderController.create.bind(OrderController));
  app.get("/orders", verifyJwt, authorize("orders", "read"), OrderController.getList.bind(OrderController));
  app.get("/orders/:id", verifyJwt, authorize("orders", "read"), OrderController.getDetail.bind(OrderController));
  app.patch("/orders/:id/status", verifyJwt, authorize("orders", "update"), OrderController.updateStatus.bind(OrderController));

  // SePay order webhook (no auth — called by SePay)
  app.post("/webhook/sepay/order", OrderController.handleSepayOrderWebhook.bind(OrderController));

  // Customer routes
  app.post("/customers", verifyJwt, CustomerController.create.bind(CustomerController));
  app.get("/customers", verifyJwt, CustomerController.getList.bind(CustomerController));
  app.get("/customers/:id", verifyJwt, CustomerController.getDetail.bind(CustomerController));
  app.patch("/customers/:id", verifyJwt, CustomerController.update.bind(CustomerController));

  console.log("✓ Order module registered");
};

module.exports = { registerOrderModule };
