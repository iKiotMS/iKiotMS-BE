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
 *     Holiday:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         date: { type: string, format: date-time }
 *         name: { type: string }
 *         type: { type: string, enum: [PUBLIC_HOLIDAY] }
 *         isActive: { type: boolean }
 *         source: { type: string, enum: [GOOGLE_CALENDAR, MANUAL] }
 *         isManuallyEdited: { type: boolean }
 *
 * /holidays:
 *   get:
 *     summary: List tenant public holidays
 *     tags: [Holiday]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: year, schema: { type: integer } }
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *       - { in: query, name: source, schema: { type: string, enum: [GOOGLE_CALENDAR, MANUAL] } }
 *       - { in: query, name: name, schema: { type: string } }
 *     responses:
 *       200: { description: Holiday list returned }
 *       400: { description: Invalid filters }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   post:
 *     summary: Create a manual public holiday
 *     tags: [Holiday]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, name]
 *             properties:
 *               date: { type: string, format: date, example: '2026-09-03' }
 *               name: { type: string, example: Nghỉ Quốc khánh bổ sung }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       201: { description: Holiday created }
 *       400: { description: Invalid input }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       409: { description: Holiday already exists on this date }
 *
 * /holidays/{holidayId}:
 *   patch:
 *     summary: Edit a tenant holiday's date or name
 *     description: Any successful edit sets isManuallyEdited=true so later Google syncs cannot overwrite it. Use the /status endpoint to enable or disable a holiday.
 *     tags: [Holiday]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: holidayId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date: { type: string, format: date }
 *               name: { type: string }
 *     responses:
 *       200: { description: Holiday updated }
 *       400: { description: Invalid input or ID }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Holiday not found }
 *       409: { description: Holiday already exists on the new date }
 *   delete:
 *     summary: Permanently delete a tenant holiday
 *     description: A deleted Google holiday may be imported again by the next sync; disable it instead for a persistent override.
 *     tags: [Holiday]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: holidayId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Holiday permanently deleted }
 *       400: { description: Invalid ID }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Holiday not found }
 *
 * /holidays/{holidayId}/status:
 *   patch:
 *     summary: Enable or disable a tenant holiday
 *     description: Sets isManuallyEdited=true so Google Calendar sync cannot overwrite the selected status.
 *     tags: [Holiday]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: holidayId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean, example: false }
 *     responses:
 *       200: { description: Holiday status updated }
 *       400: { description: Invalid ID or isActive value }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Holiday not found }
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
  app.get(
    "/holidays",
    verifyJwt,
    authorize("holidays", ["read"]),
    HolidayController.list.bind(HolidayController),
  );
  app.post(
    "/holidays",
    verifyJwt,
    authorize("holidays", ["create"]),
    HolidayController.create.bind(HolidayController),
  );
  app.patch(
    "/holidays/:holidayId",
    verifyJwt,
    authorize("holidays", ["update"]),
    HolidayController.update.bind(HolidayController),
  );
  app.patch(
    "/holidays/:holidayId/status",
    verifyJwt,
    authorize("holidays", ["update"]),
    HolidayController.updateStatus.bind(HolidayController),
  );
  app.delete(
    "/holidays/:holidayId",
    verifyJwt,
    authorize("holidays", ["delete"]),
    HolidayController.hardDelete.bind(HolidayController),
  );
  app.post(
    "/holidays/sync/vietnam",
    verifyJwt,
    authorize("holidays", ["update"]),
    HolidayController.syncVietnamHolidays.bind(HolidayController),
  );
}

module.exports = { registerHolidayModule };
