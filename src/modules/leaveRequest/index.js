const LeaveRequestController = require("./controller/LeaveRequestController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

/**
 * @openapi
 * /leave-requests:
 *   post:
 *     summary: Create a new personal leave request
 *     tags: [Leave Requests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [leaveType, startDate, endDate, reason]
 *             properties:
 *               leaveType: { type: string, enum: [ANNUAL, UNPAID, SICK, OTHER] }
 *               startDate: { type: string, format: date-time }
 *               endDate: { type: string, format: date-time }
 *               reason: { type: string }
 *               handoverToUserId:
 *                 type: string
 *                 description: Required only when a branch or warehouse manager has schedules to hand over during the leave date range.
 *     responses:
 *       201:
 *         description: Leave request created successfully
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: Validation failed }
 *                 errors:
 *                   type: object
 *                   additionalProperties: { type: string }
 *                   example:
 *                     startDate: Start date cannot be before the current time
 *                     endDate: End date cannot be before the current time
 *                     handoverToUserId: handoverToUserId must be a valid user id
 *       401:
 *         description: Unauthorized
 *   get:
 *     summary: Get all leave requests
 *     description: Get leave requests using query filters.
 *     tags: [Leave Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: recordPerPage
 *         in: query
 *         schema: { type: integer, default: 10 }
 *       - name: role
 *         in: query
 *         description: Filter by populated user's role.
 *         schema: { type: string, enum: [BRANCH_MANAGER, WAREHOUSE_MANAGER, STAFF] }
 *       - name: branchId
 *         in: query
 *         description: Filter by populated user's branch.
 *         schema: { type: string }
 *       - name: warehouseId
 *         in: query
 *         description: Filter by populated user's warehouse.
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED, DELETED] }
 *       - name: leaveType
 *         in: query
 *         schema: { type: string, enum: [ANNUAL, UNPAID, SICK, OTHER] }
 *       - name: keyword
 *         in: query
 *         description: Search by employee first name, last name, or leave reason.
 *         schema: { type: string }
 *       - name: startDate
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: endDate
 *         in: query
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Leave requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Leave requests retrieved successfully }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer, example: 25 }
 *                     page: { type: integer, example: 1 }
 *                     recordPerPage: { type: integer, example: 10 }
 *                     totalPage: { type: integer, example: 3 }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *
 * /leave-requests/handover/preview:
 *   post:
 *     summary: Preview schedules that need manager leave handover
 *     description: Read-only check. Branch and warehouse managers get schedules they manage during the requested leave dates. Other roles return requiresHandover false.
 *     tags: [Leave Requests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [startDate, endDate]
 *             properties:
 *               startDate: { type: string, format: date-time }
 *               endDate: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Schedule handover preview retrieved successfully
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: Validation failed }
 *                 errors:
 *                   type: object
 *                   additionalProperties: { type: string }
 *                   example:
 *                     startDate: Start date cannot be before the current time
 *                     endDate: End date cannot be before the current time
 *                     handoverToUserId: handoverToUserId must be a valid user id
 *       401:
 *         description: Unauthorized
 *
 * /leave-requests/me:
 *   get:
 *     summary: Get personal leave request history
 *     tags: [Leave Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: recordPerPage
 *         in: query
 *         schema: { type: integer, default: 10 }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED, DELETED] }
 *       - name: leaveType
 *         in: query
 *         schema: { type: string, enum: [ANNUAL, UNPAID, SICK, OTHER] }
 *       - name: keyword
 *         in: query
 *         schema: { type: string }
 *       - name: startDate
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: endDate
 *         in: query
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Personal leave request history retrieved successfully
 *       401:
 *         description: Unauthorized
 *
 * /leave-requests/{id}:
 *   get:
 *     summary: Get leave request detail
 *     description: Returns one leave request in the authenticated user's tenant. Users can read their own request; tenant owners and super admins can read tenant requests; branch and warehouse managers can only read requests for users in their assigned workplace.
 *     tags: [Leave Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Leave request retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Leave request retrieved successfully }
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid leave request id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Leave request not found
 *
 * /leave-requests/{id}/cancel:
 *   post:
 *     summary: Cancel a personal leave request before the leave date arrives
 *     tags: [Leave Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Leave request cancelled successfully
 *       400:
 *         description: Leave request cannot be cancelled
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Leave request not found
 *
 * /leave-requests/branches:
 *   get:
 *     summary: Get leave requests for the authenticated user's branch
 *     description: Uses the branchId from the authenticated user. No branchId path parameter is required.
 *     tags: [Leave Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: recordPerPage
 *         in: query
 *         schema: { type: integer, default: 10 }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED, DELETED] }
 *       - name: leaveType
 *         in: query
 *         schema: { type: string, enum: [ANNUAL, UNPAID, SICK, OTHER] }
 *       - name: keyword
 *         in: query
 *         schema: { type: string }
 *       - name: startDate
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: endDate
 *         in: query
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Leave requests retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *
 * /leave-requests/warehouses:
 *   get:
 *     summary: Get leave requests for the authenticated user's warehouse
 *     description: Uses the warehouseId from the authenticated user. No warehouseId path parameter is required.
 *     tags: [Leave Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: recordPerPage
 *         in: query
 *         schema: { type: integer, default: 10 }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED, DELETED] }
 *       - name: leaveType
 *         in: query
 *         schema: { type: string, enum: [ANNUAL, UNPAID, SICK, OTHER] }
 *       - name: keyword
 *         in: query
 *         schema: { type: string }
 *       - name: startDate
 *         in: query
 *         schema: { type: string, format: date-time }
 *       - name: endDate
 *         in: query
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Leave requests retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *
 * /leave-requests/{id}/approve:
 *   post:
 *     summary: Approve a pending leave request
 *     tags: [Leave Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reviewNote: { type: string }
 *     responses:
 *       200:
 *         description: Leave request approved successfully
 *       400:
 *         description: Leave request cannot be approved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Leave request not found
 *
 * /leave-requests/{id}/reject:
 *   post:
 *     summary: Reject a pending leave request with a required reason
 *     tags: [Leave Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reviewNote]
 *             properties:
 *               reviewNote: { type: string }
 *     responses:
 *       200:
 *         description: Leave request rejected successfully
 *       400:
 *         description: Validation error or leave request cannot be rejected
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Leave request not found
 *
 * /leave-requests/emergency:
 *   post:
 *     summary: Create a leave request for an employee in an emergency
 *     tags: [Leave Requests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, leaveType, startDate, endDate, reason]
 *             properties:
 *               userId: { type: string }
 *               leaveType: { type: string, enum: [ANNUAL, UNPAID, SICK, OTHER] }
 *               startDate: { type: string, format: date-time }
 *               endDate: { type: string, format: date-time }
 *               reason: { type: string }
 *     responses:
 *       201:
 *         description: Emergency leave request created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Employee not found
 */
function registerLeaveRequestModule(app) {
  app.post(
    "/leave-requests",
    verifyJwt,
    LeaveRequestController.create.bind(LeaveRequestController),
  );

  app.post(
    "/leave-requests/handover/preview",
    verifyJwt,
    LeaveRequestController.previewScheduleHandover.bind(LeaveRequestController),
  );

  app.get(
    "/leave-requests/me",
    verifyJwt,
    authorize("leaveRequests", "read_mine"),
    LeaveRequestController.getPersonalHistory.bind(LeaveRequestController),
  );

  app.post(
    "/leave-requests/:id/cancel",
    verifyJwt,
    authorize("leaveRequests", "cancel"),
    LeaveRequestController.cancel.bind(LeaveRequestController),
  );
  app.get(
    "/leave-requests",
    verifyJwt,
    authorize("leaveRequests", "read_all"),
    LeaveRequestController.getAll.bind(LeaveRequestController),
  );
  app.get(
    "/leave-requests/branches",
    verifyJwt,
    authorize("leaveRequests", "readBR"),
    LeaveRequestController.getByBranch.bind(LeaveRequestController),
  );

  app.get(
    "/leave-requests/warehouses",
    verifyJwt,
    authorize("leaveRequests", "readWH"),
    LeaveRequestController.getByWarehouse.bind(LeaveRequestController),
  );

  app.get(
    "/leave-requests/:id",
    verifyJwt,
    LeaveRequestController.getDetail.bind(LeaveRequestController),
  );

  app.post(
    "/leave-requests/:id/approve",
    verifyJwt,
    authorize("leaveRequests", "approve"),
    LeaveRequestController.approve.bind(LeaveRequestController),
  );

  app.post(
    "/leave-requests/:id/reject",
    verifyJwt,
    authorize("leaveRequests", "reject"),
    LeaveRequestController.reject.bind(LeaveRequestController),
  );

  app.post(
    "/leave-requests/emergency",
    verifyJwt,
    authorize("leaveRequests", "create_emergency"),
    LeaveRequestController.createEmergency.bind(LeaveRequestController),
  );

  console.log("✓ Leave request module registered");
}

module.exports = { registerLeaveRequestModule };
