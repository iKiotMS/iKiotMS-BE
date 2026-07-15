const StockMovementController = require("./controller/StockMovementController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

/**
 * @openapi
 * tags:
 *   name: StockMovements
 *   description: Stock Movement Request management (IMPORT, EXPORT, RETURN, ADJUST)
 * 
 * /stock-movements:
 *   post:
 *     tags: [StockMovements]
 *     summary: Create a new stock movement request
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [movementType]
 *             properties:
 *               movementType: { type: string, enum: [IMPORT, EXPORT, RETURN, ADJUST] }
 *               fromSupplierId: { type: string, description: "Required for IMPORT" }
 *               fromLocationId: { type: string, description: "Auto-filled for BM/WM. Required for TENANT_OWNER for EXPORT, RETURN, ADJUST" }
 *               fromLocationType: { type: string, enum: [branch, warehouse] }
 *               toLocationId: { type: string, description: "Required for IMPORT, EXPORT, RETURN" }
 *               toLocationType: { type: string, enum: [branch, warehouse] }
 *               note: { type: string }
 *               details:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productItemId: { type: string }
 *                     quantity: { type: integer, description: "Required for IMPORT, EXPORT, RETURN (> 0)" }
 *                     importPrice: { type: number, description: "Required for IMPORT (> 0, must be <= retailPrice). For EXPORT/RETURN, auto-filled with product costPrice if omitted, but can be manually overridden." }
 *                     receivedQuantity: { type: integer, description: "Required for ADJUST (>= 0)" }
 *     responses:
 *       201:
 *         description: Request created successfully (DRAFT or PENDING based on type)
 * 
 *   get:
 *     tags: [StockMovements]
 *     summary: List stock movement requests
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
 *         schema: { type: string }
 *       - in: query
 *         name: movementType
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: A list of requests
 * 
 * /stock-movements/{id}:
 *   get:
 *     tags: [StockMovements]
 *     summary: Get a request by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Request details
 * 
 * /stock-movements/{id}/details:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Update details (products and quantities) for EXPORT/RETURN
 *     description: Only works when status is OPENING. Checks stock limits.
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
 *               details:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productItemId: { type: string }
 *                     quantity: { type: integer }
 *                     importPrice: { type: number, description: "For IMPORT, must be <= retailPrice. For EXPORT/RETURN, auto-filled with product costPrice if omitted, but can be manually overridden." }
 *                     receivedQuantity: { type: integer }
 *     responses:
 *       200:
 *         description: Details updated
 * 
 * /stock-movements/{id}/open:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Transition DRAFT to OPENING
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Status updated to OPENING
 * 
 * /stock-movements/{id}/close:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Transition OPENING to CLOSED
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Status updated to CLOSED
 * 
 * /stock-movements/{id}/ship:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Transition CLOSED/PENDING to IN_TRANSIT
 *     description: Deducts stock from sender location for EXPORT/RETURN.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Status updated to IN_TRANSIT and stock deducted
 * 
 * /stock-movements/{id}/receive:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Transition IN_TRANSIT to RECEIVED
 *     description: Adds received stock to destination and updates supplier debt if IMPORT.
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
 *               details:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productItemId: { type: string }
 *                     receivedQuantity: { type: integer }
 *     responses:
 *       200:
 *         description: Stock added and status updated to RECEIVED
 * 
 * /stock-movements/{id}/approve-adjust:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Approve an ADJUST request
 *     description: Transitions PENDING to COMPLETED and instantly updates stock.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Stock adjusted and status updated to COMPLETED
 * 
 * /stock-movements/{id}/cancel:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Cancel a stock movement request
 *     description: Rollbacks stock if the request was already IN_TRANSIT.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Request cancelled
 */
const registerStockMovementModule = (app) => {
  app.post("/stock-movements", verifyJwt, authorize("stock_movement", "create"), StockMovementController.create.bind(StockMovementController));
  app.get("/stock-movements", verifyJwt, authorize("stock_movement", "read"), StockMovementController.getList.bind(StockMovementController));
  app.get("/stock-movements/:id", verifyJwt, authorize("stock_movement", "read"), StockMovementController.getDetail.bind(StockMovementController));

  app.patch("/stock-movements/:id/details", verifyJwt, authorize("stock_movement", "update"), StockMovementController.updateDetails.bind(StockMovementController));
  app.patch("/stock-movements/:id/open", verifyJwt, authorize("stock_movement", "update"), StockMovementController.open.bind(StockMovementController));
  app.patch("/stock-movements/:id/close", verifyJwt, authorize("stock_movement", "update"), StockMovementController.close.bind(StockMovementController));
  app.patch("/stock-movements/:id/ship", verifyJwt, authorize("stock_movement", "approve"), StockMovementController.ship.bind(StockMovementController));
  
  app.patch("/stock-movements/:id/receive", verifyJwt, authorize("stock_movement", "receive"), StockMovementController.receive.bind(StockMovementController));
  app.patch("/stock-movements/:id/approve-adjust", verifyJwt, authorize("stock_movement", "approve"), StockMovementController.approveAdjust.bind(StockMovementController));
  app.patch("/stock-movements/:id/cancel", verifyJwt, authorize("stock_movement", "cancel"), StockMovementController.cancel.bind(StockMovementController));

  console.log("✓ Stock Movement module registered");
};

module.exports = { registerStockMovementModule };
