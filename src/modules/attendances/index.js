const AttendanceController = require("./controller/AttendanceController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

/**
 * @openapi
 * components:
 *   schemas:
 *     AttendanceLocationRequest:
 *       type: object
 *       required: [latitude, longitude, accuracy]
 *       properties:
 *         latitude:
 *           type: number
 *           example: 10.762622
 *         longitude:
 *           type: number
 *           example: 106.660172
 *         accuracy:
 *           type: number
 *           example: 20
 *     AttendanceCheckInRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/AttendanceLocationRequest'
 *         - type: object
 *           required: [scheduleId, actualCheckinAt]
 *           properties:
 *             scheduleId:
 *               type: string
 *               description: Required working schedule ID selected by the employee before check-in.
 *               example: 665aaa1234567890abcdef12
 *             actualCheckinAt:
 *               type: string
 *               format: date-time
 *               example: 2026-06-25T04:30:00.000Z
 *     AttendanceCheckOutRequest:
 *       allOf:
 *         - $ref: '#/components/schemas/AttendanceLocationRequest'
 *         - type: object
 *           required: [attendanceId, actualCheckoutAt]
 *           properties:
 *             attendanceId:
 *               type: string
 *               example: 665aaa1234567890abcdef12
 *             actualCheckoutAt:
 *               type: string
 *               format: date-time
 *               example: 2026-06-25T12:30:00.000Z
 *     AttendanceGeoResult:
 *       type: object
 *       properties:
 *         verificationStatus:
 *           type: string
 *           enum: [VERIFIED, LOW_ACCURACY, OUT_OF_RANGE, NO_LOCATION]
 *           example: VERIFIED
 *         distance:
 *           type: number
 *           example: 24.5
 *         allowedRadiusMeters:
 *           type: number
 *           example: 100
 *         maxAccuracyMeters:
 *           type: number
 *           example: 50
 *     AttendanceActionResponse:
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
 *               $ref: '#/components/schemas/AttendanceGeoResult'
 *     AttendanceListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             type: object
 *         pagination:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 25
 *             page:
 *               type: integer
 *               example: 1
 *             recordPerPage:
 *               type: integer
 *               example: 10
 *             totalPages:
 *               type: integer
 *               example: 3
 *     AttendanceDetailResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
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
 * /attendances:
 *   get:
 *     tags: [Attendances]
 *     summary: Get attendance list
 *     description: Returns attendance records filtered by query parameters. Branch and warehouse managers are automatically scoped to their assigned workplace.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: query
 *         schema: { type: string }
 *       - name: branchId
 *         in: query
 *         schema: { type: string }
 *       - name: warehouseId
 *         in: query
 *         schema: { type: string }
 *       - name: scheduleId
 *         in: query
 *         description: Filter by working schedule ID
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [CHECKED_IN, CHECKED_OUT, ABSENT]
 *       - name: checkinFrom
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: checkinTo
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: checkoutFrom
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: checkoutTo
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: lateOnly
 *         in: query
 *         schema: { type: boolean }
 *       - name: overtimeOnly
 *         in: query
 *         schema: { type: boolean }
 *       - name: missingCheckout
 *         in: query
 *         schema: { type: boolean }
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: recordPerPage
 *         in: query
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Attendance list returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceListResponse'
 *       400:
 *         description: Invalid filter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *
 * /attendances/me:
 *   get:
 *     tags: [Attendances]
 *     summary: Get current user's attendance list
 *     description: Returns attendance records for the authenticated user. The userId and workplace scope are derived from the JWT, not query parameters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: scheduleId
 *         in: query
 *         description: Filter current user's records by working schedule ID
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [CHECKED_IN, CHECKED_OUT, ABSENT]
 *       - name: checkinFrom
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: checkinTo
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: checkoutFrom
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: checkoutTo
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: lateOnly
 *         in: query
 *         schema: { type: boolean }
 *       - name: overtimeOnly
 *         in: query
 *         schema: { type: boolean }
 *       - name: missingCheckout
 *         in: query
 *         schema: { type: boolean }
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: recordPerPage
 *         in: query
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Current user's attendance list returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceListResponse'
 *       400:
 *         description: Invalid filter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *
 * /attendances/{attendanceId}:
 *   get:
 *     tags: [Attendances]
 *     summary: Get attendance detail
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: attendanceId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Attendance detail returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceDetailResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden or attendance belongs to another user's scope
 *       404:
 *         description: Attendance not found
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
 *               $ref: '#/components/schemas/AttendanceActionResponse'
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
 *       404:
 *         description: Working schedule not found
 *       409:
 *         description: The employee already has an attendance for this working schedule
 *       422:
 *         description: GPS accuracy is not good enough for check-in
 *
 * /attendances/check-out:
 *   post:
 *     tags: [Attendances]
 *     summary: Employee check-out for an attendance record
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AttendanceCheckOutRequest'
 *     responses:
 *       200:
 *         description: Check-out successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceActionResponse'
 *       400:
 *         description: Validation error or attendance is not checked in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceErrorResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Employee is outside the allowed check-out area
 *       404:
 *         description: Attendance not found
 *       422:
 *         description: Invalid check-out time or GPS accuracy
 */
function registerAttendanceModule(app) {
  app.get(
    "/attendances",
    verifyJwt,
    authorize("attendances", "read"),
    AttendanceController.getAttendances.bind(AttendanceController),
  );

  app.get(
    "/attendances/me",
    verifyJwt,
    authorize("attendances", "read_own"),
    AttendanceController.getMyAttendances.bind(AttendanceController),
  );

  app.get(
    "/attendances/:attendanceId",
    verifyJwt,
    authorize("attendances", ["read", "read_own"]),
    AttendanceController.getAttendanceDetail.bind(AttendanceController),
  );

  app.post(
    "/attendances/check-in",
    verifyJwt,
    authorize("attendances", "create"),
    AttendanceController.checkIn.bind(AttendanceController),
  );

  app.post(
    "/attendances/check-out",
    verifyJwt,
    authorize("attendances", "update"),
    AttendanceController.checkOut.bind(AttendanceController),
  );

  console.log("✓ Attendance module registered");
}

module.exports = { registerAttendanceModule };
