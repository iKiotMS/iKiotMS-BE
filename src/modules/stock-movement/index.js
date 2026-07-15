const StockMovementController = require("./controller/StockMovementController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

/**
 * @openapi
 * tags:
 *   name: StockMovements
 *   description: Stock Movement Request management (IMPORT, EXPORT, RETURN, ADJUST). EXPORT is the warehouse-transfer flow; TRANSFER is not a movementType.
 * 
 * /stock-movements:
 *   post:
 *     tags: [StockMovements]
 *     summary: Create a new stock movement request
 *     description: A STAFF user may create IMPORT, EXPORT, RETURN, or ADJUST requests only while managedBy an active SCHEDULED working schedule (startAt <= now < endAt) and only for a scheduled branch or warehouse location.
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
 *       400:
 *         description: Invalid movement payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing permission, inactive managed schedule, or location outside schedule scope
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 * 
 *   get:
 *     tags: [StockMovements]
 *     summary: List stock movement requests
 *     description: A STAFF user may list requests only during an active managed schedule. Results are restricted to scheduled branch and warehouse locations.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing permission or no active managed working schedule
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 * 
 * /stock-movements/{id}:
 *   get:
 *     tags: [StockMovements]
 *     summary: Get a request by ID
 *     description: Temporary managed STAFF access requires an active schedule and a source or destination inside the schedule location scope.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing permission, inactive managed schedule, or movement outside schedule scope
 *       404:
 *         description: Stock movement request not found
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 * 
 * /stock-movements/{id}/details:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Update details (products and quantities) for EXPORT/RETURN
 *     description: Only works when status is OPENING. Checks stock limits. Temporary managed STAFF access is limited to the four documented types and scheduled locations.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing permission, inactive managed schedule, or movement outside schedule scope
 *       404:
 *         description: Stock movement request not found
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 * 
 * /stock-movements/{id}/open:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Transition DRAFT to OPENING
 *     description: Temporary managed STAFF access requires an active schedule and the movement source location; IMPORT uses its destination location.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing permission, inactive managed schedule, or movement outside schedule scope
 *       404:
 *         description: Stock movement request not found
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 * 
 * /stock-movements/{id}/close:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Transition OPENING to CLOSED
 *     description: Temporary managed STAFF access requires an active schedule and the movement source location; IMPORT uses its destination location.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing permission, inactive managed schedule, or movement outside schedule scope
 *       404:
 *         description: Stock movement request not found
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 * 
 * /stock-movements/{id}/ship:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Transition CLOSED/PENDING to IN_TRANSIT
 *     description: Deducts stock from sender location for EXPORT/RETURN. Temporary managed STAFF access is restricted to an active schedule location.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing permission, inactive managed schedule, or movement outside schedule scope
 *       404:
 *         description: Stock movement request not found
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 * 
 * /stock-movements/{id}/receive:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Transition IN_TRANSIT to RECEIVED
 *     description: Adds received stock to destination and updates supplier debt if IMPORT. Temporary managed STAFF access requires the destination to be in the active schedule scope.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing permission, inactive managed schedule, or destination outside schedule scope
 *       404:
 *         description: Stock movement request not found
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 * 
 * /stock-movements/{id}/approve-adjust:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Approve an ADJUST request
 *     description: Transitions PENDING to COMPLETED and instantly updates stock. Temporary managed STAFF access requires the adjusted location to be in the active schedule scope.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing permission, inactive managed schedule, or adjustment outside schedule scope
 *       404:
 *         description: Stock movement request not found
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
 * 
 * /stock-movements/{id}/cancel:
 *   patch:
 *     tags: [StockMovements]
 *     summary: Cancel a stock movement request
 *     description: Rollbacks stock if the request was already IN_TRANSIT. Temporary managed STAFF access is restricted to the active schedule location.
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Missing permission, inactive managed schedule, or movement outside schedule scope
 *       404:
 *         description: Stock movement request not found
 *       500:
 *         description: Failed to verify managed schedule access or unexpected server error
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
