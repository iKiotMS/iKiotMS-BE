const StockMovementController = require("./controller/StockMovementController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

/**
 * @openapi
 * /stock-movements:
 *   post:
 *     tags: [Stock Movement]
 *     summary: Create an import or transfer request
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [movementType, toLocationId, toLocationType, details]
 *             properties:
 *               movementType: { type: string, enum: [IMPORT, TRANSFER, RETURN, ADJUST] }
 *               fromSupplierId: { type: string, description: "Required if IMPORT" }
 *               fromLocationId: { type: string, description: "Required if TRANSFER" }
 *               fromLocationType: { type: string, enum: [branch, warehouse] }
 *               toLocationId: { type: string }
 *               toLocationType: { type: string, enum: [branch, warehouse] }
 *               note: { type: string }
 *               details:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productItemId: { type: string }
 *                     quantity: { type: integer, description: "Requested quantity" }
 *                     importPrice: { type: number, description: "Required for IMPORT to update debt" }
 *     responses:
 *       201:
 *         description: Created
 *   get:
 *     tags: [Stock Movement]
 *     summary: Get list of requests
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
 *         name: status
 *         schema: { type: string, enum: [PENDING, IN_TRANSIT, RECEIVED, CANCELLED] }
 *       - in: query
 *         name: movementType
 *         schema: { type: string, enum: [IMPORT, TRANSFER, RETURN, ADJUST] }
 *     responses:
 *       200:
 *         description: Success
 * /stock-movements/{id}:
 *   get:
 *     tags: [Stock Movement]
 *     summary: Get request detail
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Success
 * /stock-movements/{id}/approve:
 *   patch:
 *     tags: [Stock Movement]
 *     summary: Approve a PENDING request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Approved and moved to IN_TRANSIT
 * /stock-movements/{id}/receive:
 *   patch:
 *     tags: [Stock Movement]
 *     summary: Receive goods and update inventory/debt
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
 *             required: [details]
 *             properties:
 *               details:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productItemId: { type: string }
 *                     receivedQuantity: { type: integer }
 *     responses:
 *       200:
 *         description: Inventory updated, Debt updated (if IMPORT)
 * /stock-movements/{id}/cancel:
 *   patch:
 *     tags: [Stock Movement]
 *     summary: Cancel a request and rollback reservations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Cancelled
 */
const registerStockMovementModule = (app) => {
  app.post("/stock-movements", verifyJwt, StockMovementController.create.bind(StockMovementController));
  app.get("/stock-movements", verifyJwt, StockMovementController.getList.bind(StockMovementController));
  app.get("/stock-movements/:id", verifyJwt, StockMovementController.getDetail.bind(StockMovementController));
  app.patch("/stock-movements/:id/approve", verifyJwt, StockMovementController.approve.bind(StockMovementController));
  app.patch("/stock-movements/:id/receive", verifyJwt, StockMovementController.receive.bind(StockMovementController));
  app.patch("/stock-movements/:id/cancel", verifyJwt, StockMovementController.cancel.bind(StockMovementController));

  console.log("✓ Stock Movement module registered");
};

module.exports = { registerStockMovementModule };
