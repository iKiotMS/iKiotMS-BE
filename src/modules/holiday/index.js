const HolidayController = require("./controller/HolidayController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

/**
 * @openapi
 * components:
 *   schemas:
 *     SyncVietnamHolidayRequest:
 *       type: object
 *       required: [year]
 *       properties:
 *         year:
 *           type: integer
 *           example: 2026
 *     HolidaySyncItem:
 *       type: object
 *       properties:
 *         date:
 *           type: string
 *           format: date-time
 *           example: "2026-09-02T00:00:00.000Z"
 *         name:
 *           type: string
 *           example: Quốc khánh
 *
 * /holidays/sync/vietnam:
 *   post:
 *     summary: Sync Vietnam public holidays from Google Calendar
 *     tags: [Holiday]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SyncVietnamHolidayRequest'
 *     responses:
 *       200:
 *         description: Holidays synced successfully
 *       400:
 *         description: Validation error or Google Calendar sync failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
function registerHolidayModule(app) {
  app.post(
    "/holidays/sync/vietnam",
    verifyJwt,
    authorize("payrollSettings", ["update"]),
    HolidayController.syncVietnamHolidays.bind(HolidayController),
  );
}

module.exports = { registerHolidayModule };
