const SupplierController = require("./controller/SupplierController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

/**
 * @openapi
 * /suppliers:
 *   post:
 *     tags: [Suppliers]
 *     summary: Create a new supplier
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [supplierName]
 *             properties:
 *               supplierName: { type: string }
 *               contactName: { type: string }
 *               phoneNumber: { type: string }
 *               email: { type: string }
 *               address: { type: string }
 *               creditLimit: { type: number, default: 0 }
 *     responses:
 *       201:
 *         description: Supplier created successfully
 *   get:
 *     tags: [Suppliers]
 *     summary: Get list of suppliers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: hasDebt
 *         schema: { type: string, enum: ['true', 'false'] }
 *         description: Filter suppliers who have outstanding debt > 0
 *     responses:
 *       200:
 *         description: List of suppliers
 * /suppliers/{id}:
 *   get:
 *     tags: [Suppliers]
 *     summary: Get supplier by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Supplier details
 *   patch:
 *     tags: [Suppliers]
 *     summary: Update supplier
 *     description: You cannot update outstandingDebt via this endpoint.
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
 *               supplierName: { type: string }
 *               contactName: { type: string }
 *               phoneNumber: { type: string }
 *               email: { type: string }
 *               address: { type: string }
 *               creditLimit: { type: number }
 *     responses:
 *       200:
 *         description: Supplier updated
 *   delete:
 *     tags: [Suppliers]
 *     summary: Delete supplier
 *     description: Fails if the supplier has outstanding debt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Supplier deleted
 *       400:
 *         description: Cannot delete because it has outstanding debt
 * /suppliers/{id}/payments:
 *   post:
 *     tags: [Suppliers]
 *     summary: Pay debt to supplier
 *     description: Reduces outstandingDebt and generates a CashFlow expense record using MongoDB Transactions.
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
 *             required: [amount]
 *             properties:
 *               amount: { type: number, description: "Amount to pay" }
 *               paymentMethod: { type: string, enum: [CASH, BANK_TRANSFER, MOMO, VNPAY, SEPAY] }
 *               branchId: { type: string, description: "Branch where the payment is made from" }
 *               note: { type: string }
 *     responses:
 *       200:
 *         description: Payment recorded successfully
 */
const registerSupplierModule = (app) => {
  app.post("/suppliers", verifyJwt, authorize("suppliers", "create"), SupplierController.create.bind(SupplierController));
  app.get("/suppliers", verifyJwt, authorize("suppliers", "read"), SupplierController.getList.bind(SupplierController));
  app.get("/suppliers/:id", verifyJwt, authorize("suppliers", "read"), SupplierController.getDetail.bind(SupplierController));
  app.patch("/suppliers/:id", verifyJwt, authorize("suppliers", "update"), SupplierController.update.bind(SupplierController));
  app.delete("/suppliers/:id", verifyJwt, authorize("suppliers", "delete"), SupplierController.delete.bind(SupplierController));
  app.post("/suppliers/:id/payments", verifyJwt, authorize("suppliers", "update"), SupplierController.payDebt.bind(SupplierController));

  console.log("✓ Supplier module registered");
};

module.exports = { registerSupplierModule };
