const AttendanceController = require("./controller/AttendanceController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

/**
 * @openapi
 * components:
 *   schemas:
 *     AttendanceCheckInRequest:
 *       type: object
 *       required: [scheduleId, latitude, longitude, accuracy]
 *       properties:
 *         scheduleId:
 *           type: string
 *           example: 665aaa1234567890abcdef12
 *         latitude:
 *           type: number
 *           example: 10.762622
 *         longitude:
 *           type: number
 *           example: 106.660172
 *         accuracy:
 *           type: number
 *           example: 20
 *
 * /attendances/check-in:
 *   post:
 *     tags: [Attendances]
 *     summary: Employee check-in for a working schedule
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AttendanceCheckInRequest'
 *     responses:
 *       201:
 *         description: Check-in successful
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Working schedule not found
 *       409:
 *         description: Already checked in
 */
function registerAttendanceModule(app) {
  app.post(
    "/attendances/check-in",
    verifyJwt,
    AttendanceController.checkIn.bind(AttendanceController),
  );

  console.log("✓ Attendance module registered");
}

module.exports = { registerAttendanceModule };
