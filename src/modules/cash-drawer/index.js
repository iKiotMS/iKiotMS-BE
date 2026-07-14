const CashDrawerController = require("./controller/CashDrawerController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

/**
 * @openapi
 * components:
 *   schemas:
 *     CashDrawerShiftLog:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         staffId: { type: string }
 *         amount: { type: integer, minimum: 0 }
 *         nextStaffId: { type: string, nullable: true }
 *         note: { type: string }
 *         loggedAt: { type: string, format: date-time }
 *     CashDrawerSessionSummary:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         tenantId: { type: string }
 *         branchId: { type: string }
 *         businessDate: { type: string, format: date }
 *         status: { type: string, enum: [OPEN, CLOSED] }
 *         openingAmount: { type: integer, minimum: 0 }
 *         openedBy: { type: string }
 *         currentStaffId: { type: string }
 *         finalLog:
 *           type: object
 *           properties:
 *             amount: { type: integer, minimum: 0 }
 *             managerId: { type: string }
 *             note: { type: string }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     CashDrawerSessionDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/CashDrawerSessionSummary'
 *         - type: object
 *           properties:
 *             shiftLogs:
 *               type: array
 *               items: { $ref: '#/components/schemas/CashDrawerShiftLog' }
 *     CashDrawerResponse:
 *       type: object
 *       required: [success, data]
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string }
 *         data: { $ref: '#/components/schemas/CashDrawerSessionDetail' }
 *     CashDrawerListResponse:
 *       type: object
 *       required: [success, data, pagination]
 *       properties:
 *         success: { type: boolean, example: true }
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/CashDrawerSessionSummary' }
 *         pagination:
 *           type: object
 *           properties:
 *             total: { type: integer }
 *             page: { type: integer }
 *             limit: { type: integer }
 *             totalPages: { type: integer }
 *     CashDrawerError:
 *       type: object
 *       required: [success, message]
 *       properties:
 *         success: { type: boolean, example: false }
 *         message: { type: string }
 *         errors: { type: object, additionalProperties: true }
 *   responses:
 *     CashDrawerBadRequest:
 *       description: Validation error
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CashDrawerError' }
 *     CashDrawerUnauthorized:
 *       description: Missing or invalid authentication
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CashDrawerError' }
 *     CashDrawerForbidden:
 *       description: Insufficient permission or cross-branch access
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CashDrawerError' }
 *     CashDrawerNotFound:
 *       description: Cash drawer, branch, or staff member not found
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CashDrawerError' }
 *     CashDrawerConflict:
 *       description: Duplicate or concurrently changed cash drawer state
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CashDrawerError' }
 *     CashDrawerServerError:
 *       description: Unexpected server error
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CashDrawerError' }
 *
 * /cash-drawer-sessions:
 *   post:
 *     summary: Open the branch cash drawer log for the business day
 *     tags: [Cash Drawer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [branchId, openingAmount, staffId]
 *             properties:
 *               branchId: { type: string }
 *               openingAmount: { type: integer, minimum: 0 }
 *               staffId: { type: string }
 *     responses:
 *       201:
 *         description: Cash drawer log opened
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CashDrawerResponse' }
 *       400: { $ref: '#/components/responses/CashDrawerBadRequest' }
 *       401: { $ref: '#/components/responses/CashDrawerUnauthorized' }
 *       403: { $ref: '#/components/responses/CashDrawerForbidden' }
 *       404: { $ref: '#/components/responses/CashDrawerNotFound' }
 *       409: { $ref: '#/components/responses/CashDrawerConflict' }
 *       500: { $ref: '#/components/responses/CashDrawerServerError' }
 *   get:
 *     summary: List cash drawer log history without nested shift logs
 *     tags: [Cash Drawer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema: { type: string }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, CLOSED] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated cash drawer log summaries
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CashDrawerListResponse' }
 *       400: { $ref: '#/components/responses/CashDrawerBadRequest' }
 *       401: { $ref: '#/components/responses/CashDrawerUnauthorized' }
 *       403: { $ref: '#/components/responses/CashDrawerForbidden' }
 *       500: { $ref: '#/components/responses/CashDrawerServerError' }
 *
 * /cash-drawer-sessions/current:
 *   get:
 *     summary: Get the current open cash drawer log including shift logs
 *     tags: [Cash Drawer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema: { type: string }
 *         description: Required for tenant-wide roles; branch-scoped roles use their assigned branch.
 *     responses:
 *       200:
 *         description: Current open cash drawer log
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CashDrawerResponse' }
 *       400: { $ref: '#/components/responses/CashDrawerBadRequest' }
 *       401: { $ref: '#/components/responses/CashDrawerUnauthorized' }
 *       403: { $ref: '#/components/responses/CashDrawerForbidden' }
 *       404: { $ref: '#/components/responses/CashDrawerNotFound' }
 *       500: { $ref: '#/components/responses/CashDrawerServerError' }
 *
 * /cash-drawer-sessions/{id}:
 *   get:
 *     summary: Get a cash drawer log including shift logs
 *     tags: [Cash Drawer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Cash drawer log detail
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CashDrawerResponse' }
 *       400: { $ref: '#/components/responses/CashDrawerBadRequest' }
 *       401: { $ref: '#/components/responses/CashDrawerUnauthorized' }
 *       403: { $ref: '#/components/responses/CashDrawerForbidden' }
 *       404: { $ref: '#/components/responses/CashDrawerNotFound' }
 *       500: { $ref: '#/components/responses/CashDrawerServerError' }
 *
 * /cash-drawer-sessions/{id}/shift-logs:
 *   post:
 *     summary: Log the amount left at shift end and optionally hand over to the next staff member
 *     tags: [Cash Drawer]
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
 *               amount: { type: integer, minimum: 0 }
 *               nextStaffId: { type: string }
 *               note: { type: string }
 *     responses:
 *       201:
 *         description: Shift log recorded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CashDrawerResponse' }
 *       400: { $ref: '#/components/responses/CashDrawerBadRequest' }
 *       401: { $ref: '#/components/responses/CashDrawerUnauthorized' }
 *       403: { $ref: '#/components/responses/CashDrawerForbidden' }
 *       404: { $ref: '#/components/responses/CashDrawerNotFound' }
 *       409: { $ref: '#/components/responses/CashDrawerConflict' }
 *       500: { $ref: '#/components/responses/CashDrawerServerError' }
 *
 * /cash-drawer-sessions/{id}/finalize:
 *   post:
 *     summary: Log the amount retrieved by the manager and close the business day
 *     tags: [Cash Drawer]
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
 *             required: [finalAmount]
 *             properties:
 *               finalAmount: { type: integer, minimum: 0 }
 *               note: { type: string }
 *     responses:
 *       200:
 *         description: Cash drawer finalized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CashDrawerResponse' }
 *       400: { $ref: '#/components/responses/CashDrawerBadRequest' }
 *       401: { $ref: '#/components/responses/CashDrawerUnauthorized' }
 *       403: { $ref: '#/components/responses/CashDrawerForbidden' }
 *       404: { $ref: '#/components/responses/CashDrawerNotFound' }
 *       409: { $ref: '#/components/responses/CashDrawerConflict' }
 *       500: { $ref: '#/components/responses/CashDrawerServerError' }
 */
function registerCashDrawerModule(app) {
  app.post(
    "/cash-drawer-sessions",
    verifyJwt,
    authorize("cash_drawers", "open"),
    CashDrawerController.open.bind(CashDrawerController),
  );
  app.get(
    "/cash-drawer-sessions/current",
    verifyJwt,
    authorize("cash_drawers", ["read", "read_own"]),
    CashDrawerController.current.bind(CashDrawerController),
  );
  app.get(
    "/cash-drawer-sessions",
    verifyJwt,
    authorize("cash_drawers", ["read", "read_own"]),
    CashDrawerController.list.bind(CashDrawerController),
  );
  app.get(
    "/cash-drawer-sessions/:id",
    verifyJwt,
    authorize("cash_drawers", ["read", "read_own"]),
    CashDrawerController.detail.bind(CashDrawerController),
  );
  app.post(
    "/cash-drawer-sessions/:id/shift-logs",
    verifyJwt,
    authorize("cash_drawers", "report"),
    CashDrawerController.createShiftLog.bind(CashDrawerController),
  );
  app.post(
    "/cash-drawer-sessions/:id/finalize",
    verifyJwt,
    authorize("cash_drawers", "finalize"),
    CashDrawerController.finalize.bind(CashDrawerController),
  );

  console.log("✓ Cash drawer module registered");
}

module.exports = { registerCashDrawerModule };
