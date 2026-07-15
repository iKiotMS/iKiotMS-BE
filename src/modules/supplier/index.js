const SupplierController = require("./controller/SupplierController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

/**
 * @openapi
 * /suppliers:
 *   post:
 *     tags: [Suppliers]
 *     summary: Create a new supplier
 *     description: Requires the permanent suppliers create permission. This permission is not granted temporarily to managedBy STAFF.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing permanent suppliers create permission
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 *   get:
 *     tags: [Suppliers]
 *     summary: Get list of suppliers
 *     description: Requires the suppliers read permission. A STAFF user receives this permission temporarily only while they are managedBy an active SCHEDULED working schedule (startAt <= now < endAt).
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing role permission or no active managed working schedule
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 * /suppliers/{id}:
 *   get:
 *     tags: [Suppliers]
 *     summary: Get supplier by ID
 *     description: Requires the suppliers read permission. A STAFF user receives this permission temporarily only during an active managed working schedule.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing role permission or no active managed working schedule
 *       404:
 *         description: Supplier not found
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 *   patch:
 *     tags: [Suppliers]
 *     summary: Update supplier
 *     description: You cannot update outstandingDebt via this endpoint. A STAFF user receives the suppliers update permission temporarily only during an active managed working schedule.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing role permission or no active managed working schedule
 *       404:
 *         description: Supplier not found
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 *   delete:
 *     tags: [Suppliers]
 *     summary: Delete supplier
 *     description: Fails if the supplier has outstanding debt. A STAFF user receives the suppliers delete permission temporarily only during an active managed working schedule.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing role permission or no active managed working schedule
 *       404:
 *         description: Supplier not found
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 * /suppliers/{id}/payments:
 *   post:
 *     tags: [Suppliers]
 *     summary: Pay debt to supplier
 *     description: Reduces outstandingDebt and generates a CashFlow expense record using MongoDB Transactions. This financial action requires the permanent suppliers pay_debt permission and is not granted to managedBy STAFF.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing role permission or no active managed working schedule
 *       404:
 *         description: Supplier not found
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 */
const registerSupplierModule = (app) => {
  app.post("/suppliers", verifyJwt, authorize("suppliers", "create"), SupplierController.create.bind(SupplierController));
  app.get("/suppliers", verifyJwt, authorize("suppliers", "read"), SupplierController.getList.bind(SupplierController));
  app.get("/suppliers/:id", verifyJwt, authorize("suppliers", "read"), SupplierController.getDetail.bind(SupplierController));
  app.patch("/suppliers/:id", verifyJwt, authorize("suppliers", "update"), SupplierController.update.bind(SupplierController));
  app.delete("/suppliers/:id", verifyJwt, authorize("suppliers", "delete"), SupplierController.delete.bind(SupplierController));
  app.post("/suppliers/:id/payments", verifyJwt, authorize("suppliers", "pay_debt"), SupplierController.payDebt.bind(SupplierController));

  console.log("✓ Supplier module registered");
};

module.exports = { registerSupplierModule };
