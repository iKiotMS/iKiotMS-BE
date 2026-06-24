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
 *     AttendanceCheckInResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Check-in thành công
 *         data:
 *           type: object
 *           properties:
 *             attendance:
 *               type: object
 *             geo:
 *               type: object
 *               properties:
 *                 verificationStatus:
 *                   type: string
 *                   enum: [VERIFIED, LOW_ACCURACY, OUT_OF_RANGE, NO_LOCATION]
 *                   example: VERIFIED
 *                 distance:
 *                   type: number
 *                   example: 24.5
 *                 allowedRadiusMeters:
 *                   type: number
 *                   example: 100
 *                 maxAccuracyMeters:
 *                   type: number
 *                   example: 50
 *     AttendanceErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Dữ liệu không hợp lệ
 *         errors:
 *           oneOf:
 *             - type: array
 *               items: { type: string }
 *             - type: object
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceCheckInResponse'
 *       400:
 *         description: Validation error or attendance location is not configured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Employee is outside the allowed check-in area
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceErrorResponse'
 *       404:
 *         description: Working schedule not found
 *       409:
 *         description: Already checked in
 *       422:
 *         description: GPS accuracy is not good enough for check-in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceErrorResponse'
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
