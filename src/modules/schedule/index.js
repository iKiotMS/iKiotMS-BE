const ShiftTemplateController = require("./controller/ShiftTemplateController");
const WorkingScheduleController = require("./controller/WorkingScheduleController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");
const { cacheResponse } = require("../../middlewares/cacheMiddleware");
const { cacheKeys } = require("../../utils/cacheHelpers");

/**
 * @openapi
 * components:
 *   schemas:
 *     ShiftTemplateRequest:
 *       type: object
 *       required: [name, startTime, endTime]
 *       properties:
 *         name:
 *           type: string
 *           example: Ca hành chính
 *         startTime:
 *           type: string
 *           example: "08:00"
 *         endTime:
 *           type: string
 *           example: "17:00"
 *     WorkingScheduleBulkRequest:
 *       type: object
 *       required: [schedules]
 *       properties:
 *         schedules:
 *           type: array
 *           items:
 *             type: object
 *             required: [userId, shiftTemplateId, workDate]
 *             properties:
 *               userId:
 *                 oneOf:
 *                   - type: string
 *                     example: 665aaa1234567890abcdef12
 *                   - type: array
 *                     items:
 *                       type: string
 *                     example: [665aaa1234567890abcdef12, 665ccc1234567890abcdef12]
 *               shiftTemplateId:
 *                 type: string
 *                 example: 665bbb1234567890abcdef12
 *               workDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-06-20"
 *               scheduleType:
 *                 type: string
 *                 enum: [NORMAL, OVERTIME]
 *                 default: NORMAL
 *                 example: NORMAL
 *     WorkingScheduleDayInfo:
 *       type: object
 *       properties:
 *         dayType:
 *           type: string
 *           enum: [NORMAL, SUNDAY, HOLIDAY, SUNDAY_HOLIDAY]
 *           example: HOLIDAY
 *         isSunday:
 *           type: boolean
 *           example: false
 *         isHoliday:
 *           type: boolean
 *           example: true
 *         holidayName:
 *           type: string
 *           nullable: true
 *           example: Quốc khánh
 *         holidayType:
 *           type: string
 *           nullable: true
 *           enum: [PUBLIC_HOLIDAY, COMPANY_HOLIDAY]
 *           example: PUBLIC_HOLIDAY
 *     WorkingScheduleDataIntegrity:
 *       type: object
 *       description: Metadata cảnh báo khi BE phát hiện các bản ghi lịch trùng nhau. API chỉ gộp response và không tự sửa dữ liệu trong DB.
 *       properties:
 *         isDuplicate:
 *           type: boolean
 *           example: true
 *         duplicateCount:
 *           type: integer
 *           example: 2
 *         duplicateScheduleIds:
 *           type: array
 *           items:
 *             type: string
 *           example: [6a5d5186b0f7c580a7e9f3da]
 *         duplicateUserIds:
 *           type: array
 *           description: Những nhân viên thực sự bị phân trùng trong các schedule trên.
 *           items:
 *             type: string
 *           example: [6a57202859c87657d93f3733]
 *         attendanceConflict:
 *           type: boolean
 *           description: True khi cùng một nhân viên có attendance trên nhiều schedule trùng.
 *           example: false
 *         attendanceConflictUserIds:
 *           type: array
 *           items:
 *             type: string
 *           example: []
 *
 * /shift-templates:
 *   post:
 *     tags: [Schedule]
 *     summary: Create shift template
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ShiftTemplateRequest'
 *     responses:
 *       201:
 *         description: Created
 *   get:
 *     tags: [Schedule]
 *     summary: Get shift templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: recordPerPage
 *         schema:
 *           type: integer
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shift template list
 *
 * /shift-templates/{shiftTemplateId}:
 *   get:
 *     tags: [Schedule]
 *     summary: Get shift template by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shiftTemplateId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shift template detail
 *   patch:
 *     tags: [Schedule]
 *     summary: Update shift template
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shiftTemplateId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ShiftTemplateRequest'
 *     responses:
 *       200:
 *         description: Updated
 *   delete:
 *     tags: [Schedule]
 *     summary: Delete shift template
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shiftTemplateId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       409:
 *         description: Schedule has attendance and cannot be deleted or replaced
 *   patch:
 *     tags: [Schedule]
 *     summary: Update a working schedule in place
 *     description: Updates assignees, shift template, work date, and schedule type without changing the schedule ID. Schedules with attendance cannot be updated.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, shiftTemplateId, workDate]
 *             properties:
 *               userId: { oneOf: [{ type: string }, { type: array, items: { type: string } }] }
 *               shiftTemplateId: { type: string }
 *               workDate: { type: string, format: date }
 *               scheduleType: { type: string, enum: [NORMAL, OVERTIME] }
 *     responses:
 *       200: { description: Working schedule updated }
 *       400: { description: Validation error or overlapping schedule }
 *       404: { description: Editable schedule not found }
 *       409: { description: Schedule already has attendance }
 *
 * /working-schedules/{scheduleId}/users/{userId}:
 *   delete:
 *     tags: [Schedule]
 *     summary: Remove one employee from a working schedule
 *     description: Only employees without attendance can be removed. If this is the final employee, the schedule is deleted.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: scheduleId, required: true, schema: { type: string } }
 *       - { in: path, name: userId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Employee removed }
 *       404: { description: Employee is not assigned to the schedule }
 *       409: { description: Employee already has attendance }
 *
 * /working-schedules/bulk:
 *   post:
 *     tags: [Schedule]
 *     summary: Bulk create working schedules
 *     description: Insert multiple scheduled shifts from the rostering UI. New records start with status SCHEDULED.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WorkingScheduleBulkRequest'
 *     responses:
 *       201:
 *         description: Created
 *       409:
 *         description: Duplicate or overlapping shift. Response includes the conflicting schedule.
 *
 * /working-schedules:
 *   get:
 *     tags: [Schedule]
 *     summary: Get working schedules with attendance summary
 *     description: Returns working schedules with each assigned user's lightweight attendance field and dayInfo. Duplicate assignments for the same user and exact shift are returned once; different users on the same shift are not treated as duplicates. dataIntegrity contains duplicate schedule IDs, affected user IDs, and attendance conflict information. Reading this endpoint never modifies duplicate records in the database.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         description: Filter schedules that include this assigned user.
 *         schema:
 *           type: string
 *       - in: query
 *         name: branchId
 *         description: Tenant owner only. Filter schedules by assigned users in a branch.
 *         schema:
 *           type: string
 *       - in: query
 *         name: warehouseId
 *         description: Tenant owner only. Filter schedules by assigned users in a warehouse.
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, COMPLETED, CANCELLED]
 *       - in: query
 *         name: scheduleType
 *         schema:
 *           type: string
 *           enum: [NORMAL, OVERTIME]
 *     responses:
 *       200:
 *         description: Deduplicated working schedule list with attendance summary and WorkingScheduleDataIntegrity metadata
 *       403:
 *         description: Forbidden
 *
 * /working-schedules/me:
 *   get:
 *     tags: [Schedule]
 *     summary: Get current user's working schedules
 *     description: Returns deduplicated schedules assigned to the authenticated user with lightweight attendance summary, dayInfo, and dataIntegrity metadata.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, COMPLETED, CANCELLED]
 *       - in: query
 *         name: scheduleType
 *         schema:
 *           type: string
 *           enum: [NORMAL, OVERTIME]
 *     responses:
 *       200:
 *         description: Current user's schedule list
 *       401:
 *         description: Unauthorized
 *
 * /working-schedules/branches:
 *   get:
 *     tags: [Schedule]
 *     summary: Get current branch manager's working schedules
 *     description: Uses branchId from the authenticated branch manager and returns duplicate schedules once with dataIntegrity metadata. Staff cannot access this endpoint.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, COMPLETED, CANCELLED]
 *       - in: query
 *         name: scheduleType
 *         schema:
 *           type: string
 *           enum: [NORMAL, OVERTIME]
 *     responses:
 *       200:
 *         description: Branch working schedule list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *
 * /working-schedules/warehouses:
 *   get:
 *     tags: [Schedule]
 *     summary: Get current warehouse manager's working schedules
 *     description: Uses warehouseId from the authenticated warehouse manager and returns duplicate schedules once with dataIntegrity metadata. Staff cannot access this endpoint.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, COMPLETED, CANCELLED]
 *       - in: query
 *         name: scheduleType
 *         schema:
 *           type: string
 *           enum: [NORMAL, OVERTIME]
 *     responses:
 *       200:
 *         description: Warehouse working schedule list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *
 * /working-schedules/current:
 *   get:
 *     tags: [Schedule]
 *     summary: Get current user's active working schedule
 *     description: Returns the authenticated user's current scheduled shift by comparing server time against startAt and endAt. Returns data null when no current shift exists.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current working schedule returned
 *       401:
 *         description: Unauthorized
 *
 * /working-schedules/{scheduleId}/users/{userId}:
 *   get:
 *     tags: [Schedule]
 *     summary: Get one user's detail in a working schedule
 *     description: Managers can view any assigned user. Staff can only view their own schedule detail.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Schedule detail with one selected user and full attendance detail
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Schedule/user assignment not found
 *
 * /working-schedules/{scheduleId}:
 *   get:
 *     tags: [Schedule]
 *     summary: Get working schedule by id with attendance detail
 *     description: Returns one working schedule with dayInfo and each assigned user's attendance detail when available. If no attendance exists for a user, attendance.status is NOT_CHECKED_IN.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Working schedule detail with attendance detail
 *   delete:
 *     tags: [Schedule]
 *     summary: Delete working schedule
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 */
function registerScheduleModule(app) {
  app.post(
    "/shift-templates",
    verifyJwt,
    authorize("schedules", ["create"]),
    ShiftTemplateController.createShiftTemplate.bind(ShiftTemplateController),
  );

  app.get(
    "/shift-templates",
    verifyJwt,
    authorize("schedules", ["read"]),
    cacheResponse(
      (req) => cacheKeys.shiftTemplateList(req.user.tenantId, req.query),
      600,
    ),
    ShiftTemplateController.getShiftTemplateList.bind(ShiftTemplateController),
  );

  app.get(
    "/shift-templates/:shiftTemplateId",
    verifyJwt,
    authorize("schedules", ["read"]),
    cacheResponse(
      (req) =>
        cacheKeys.shiftTemplateDetail(
          req.user.tenantId,
          req.params.shiftTemplateId,
        ),
      600,
    ),
    ShiftTemplateController.getShiftTemplateById.bind(ShiftTemplateController),
  );

  app.patch(
    "/shift-templates/:shiftTemplateId",
    verifyJwt,
    authorize("schedules", ["update"]),
    ShiftTemplateController.updateShiftTemplate.bind(ShiftTemplateController),
  );

  app.delete(
    "/shift-templates/:shiftTemplateId",
    verifyJwt,
    authorize("schedules", ["delete"]),
    ShiftTemplateController.deleteShiftTemplate.bind(ShiftTemplateController),
  );

  app.patch(
    "/working-schedules/:scheduleId",
    verifyJwt,
    authorize("schedules", ["update"]),
    WorkingScheduleController.updateWorkingSchedule.bind(
      WorkingScheduleController,
    ),
  );

  app.post(
    "/working-schedules/bulk",
    verifyJwt,
    authorize("schedules", ["create"]),
    WorkingScheduleController.createBulkWorkingSchedules.bind(
      WorkingScheduleController,
    ),
  );

  app.get(
    "/working-schedules",
    verifyJwt,
    authorize("schedules", "read_all"),
    WorkingScheduleController.getWorkingScheduleList.bind(
      WorkingScheduleController,
    ),
  );

  app.get(
    "/working-schedules/branches",
    verifyJwt,
    authorize("schedules", "readBR"),
    WorkingScheduleController.getBranchWorkingSchedules.bind(
      WorkingScheduleController,
    ),
  );

  app.get(
    "/working-schedules/warehouses",
    verifyJwt,
    authorize("schedules", "readWH"),
    WorkingScheduleController.getWarehouseWorkingSchedules.bind(
      WorkingScheduleController,
    ),
  );

  app.get(
    "/working-schedules/current",
    verifyJwt,
    authorize("schedules", ["read", "read_own"]),
    WorkingScheduleController.getCurrentWorkingSchedule.bind(
      WorkingScheduleController,
    ),
  );

  app.get(
    "/working-schedules/me",
    verifyJwt,
    authorize("schedules", ["read", "read_own"]),
    WorkingScheduleController.getMyWorkingSchedules.bind(
      WorkingScheduleController,
    ),
  );

  app.get(
    "/working-schedules/:scheduleId/users/:userId",
    verifyJwt,
    authorize("schedules", ["read", "read_own"]),
    WorkingScheduleController.getWorkingScheduleUserDetail.bind(
      WorkingScheduleController,
    ),
  );

  app.get(
    "/working-schedules/:scheduleId",
    verifyJwt,
    authorize("schedules", ["read", "read_own"]),
    WorkingScheduleController.getWorkingScheduleById.bind(
      WorkingScheduleController,
    ),
  );

  app.delete(
    "/working-schedules/:scheduleId/users/:userId",
    verifyJwt,
    authorize("schedules", ["delete"]),
    WorkingScheduleController.removeUserFromWorkingSchedule.bind(
      WorkingScheduleController,
    ),
  );

  app.delete(
    "/working-schedules/:scheduleId",
    verifyJwt,
    authorize("schedules", ["delete"]),
    WorkingScheduleController.deleteWorkingSchedule.bind(
      WorkingScheduleController,
    ),
  );

  console.log(" Schedule module registered");
}

module.exports = { registerScheduleModule };
