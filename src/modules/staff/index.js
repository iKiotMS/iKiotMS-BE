const StaffController = require("./controller/StaffController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");
const { requireActiveSubscription } = require("../../middlewares/subscriptionMiddleware");
const { cacheResponse } = require("../../middlewares/cacheMiddleware");
const { cacheKeys } = require("../../utils/cacheHelpers");

/**
 * @openapi
 * components:
 *   schemas:
 *     StaffProfile:
 *       type: object
 *       properties:
 *         firstName:
 *           type: string
 *           example: An
 *         lastName:
 *           type: string
 *           example: Nguyen
 *         avatarUrl:
 *           type: string
 *           example: https://example.com/avatar.png
 *         dob:
 *           type: string
 *           format: date
 *           example: 2001-04-20
 *         taxNumber:
 *           type: string
 *           example: TAX123456
 *         identificationId:
 *           type: string
 *           pattern: '^\\d{12}$'
 *           example: "079201000001"
 *           description: Số căn cước gồm 12 chữ số. Mã nơi đăng ký khai sinh, năm sinh và giới tính được kiểm tra theo thông tin nhân viên nếu có.
 *         address:
 *           type: string
 *           example: Ho Chi Minh City
 *         gender:
 *           type: string
 *           enum: [MALE, FEMALE, OTHER]
 *           example: MALE
 *     CreateStaffRequest:
 *       type: object
 *       required:
 *         - phoneNumber
 *         - role
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: staff@example.com
 *         phoneNumber:
 *           type: string
 *           pattern: '^(?:03[2-9]|05[25689]|07[06789]|08[1-9]|09\\d)\\d{7}$'
 *           example: "0901234567"
 *           description: A 10-digit Vietnamese mobile number. VoIP (065), VSAT (067), private government networks (0692-0699), Central Post Office services (080), and emergency/service numbers (111-115) are not accepted.
 *         role:
 *           type: string
 *           enum: [BRANCH_MANAGER, WAREHOUSE_MANAGER, STAFF]
 *           example: STAFF
 *         hireDate:
 *           type: string
 *           format: date
 *           example: 2026-06-12
 *         paySheetId:
 *           type: string
 *           nullable: true
 *           example: 665abc1234567890abcdef12
 *           description: Active paysheet in the authenticated tenant. Use null for no assignment.
 *         warehouseId:
 *           type: string
 *           example: null
 *         branchId:
 *           type: string
 *           example: 665abc1234567890abcdef12
 *         firstName:
 *           type: string
 *           example: An
 *           description: Stored as profile.firstName by the DTO.
 *         lastName:
 *           type: string
 *           example: Nguyen
 *           description: Stored as profile.lastName by the DTO.
 *         avatarUrl:
 *           type: string
 *           example: https://example.com/avatar.png
 *           description: Stored as profile.avatarUrl by the DTO.
 *         dob:
 *           type: string
 *           format: date
 *           example: 2001-04-20
 *           description: Stored as profile.dob by the DTO.
 *         taxNumber:
 *           type: string
 *           example: TAX123456
 *           description: Stored as profile.taxNumber by the DTO.
 *         profile:
 *           type: object
 *           description: The create DTO reads only identificationId, address, and gender from this nested object.
 *           properties:
 *             identificationId:
 *               type: string
 *               pattern: '^\\d{12}$'
 *               example: "079201000001"
 *             address:
 *               type: string
 *               example: Ho Chi Minh City
 *             gender:
 *               type: string
 *               enum: [MALE, FEMALE, OTHER]
 *               example: MALE
 *     UpdateStaffRequest:
 *       type: object
 *       properties:
 *         data:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               format: email
 *               example: updated.staff@example.com
 *             role:
 *               type: string
 *               enum: [BRANCH_MANAGER, WAREHOUSE_MANAGER, STAFF]
 *               example: STAFF
 *               description: Manager role changes are not allowed through this endpoint. Use branch or warehouse manager assignment endpoints.
 *             hireDate:
 *               type: string
 *               format: date
 *               example: 2026-06-12
 *             paySheetId:
 *               type: string
 *               nullable: true
 *               example: 665abc1234567890abcdef12
 *               description: Active paysheet in the authenticated tenant. Use null to remove the assignment.
 *             warehouseId:
 *               type: string
 *               example: null
 *             branchId:
 *               type: string
 *               example: 665abc1234567890abcdef12
 *             profile:
 *               $ref: '#/components/schemas/StaffProfile'
 *     StaffAccountPasswordRequest:
 *       type: object
 *       required:
 *         - newPassword
 *         - reEnterPassword
 *       properties:
 *         newPassword:
 *           type: string
 *           format: password
 *           minLength: 6
 *           example: "123456"
 *         reEnterPassword:
 *           type: string
 *           format: password
 *           minLength: 6
 *           example: "123456"
 *     StaffManagerReplacementRequest:
 *       type: object
 *       properties:
 *         replacementManagerId:
 *           type: string
 *           description: Required when deleting or deactivating a branch manager or warehouse manager. For branch managers, replacement must be an active staff member in the same branch. For warehouse managers, replacement can be any active staff member in the tenant.
 *           example: 665abc1234567890abcdef12
 *         deletionReason:
 *           type: string
 *           description: Optional reason recorded when the staff is soft-deleted. Ignored by account deactivation.
 *           example: Nhân viên nghỉ việc
 *     StaffRoleOption:
 *       type: object
 *       properties:
 *         value:
 *           type: string
 *           enum: [BRANCH_MANAGER, WAREHOUSE_MANAGER, STAFF]
 *           example: BRANCH_MANAGER
 *         label:
 *           type: string
 *           example: Branch Manager
 *     StaffStatusResult:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 665aaa1234567890abcdef12
 *         status:
 *           type: string
 *           enum: [INACTIVE, DELETED]
 *           example: INACTIVE
 *     UpdateAnnualLeaveDaysRequest:
 *       type: object
 *       required: [annualLeaveDays]
 *       properties:
 *         annualLeaveDays:
 *           type: number
 *           minimum: 0
 *           example: 15
 *           description: New annual leave entitlement. Backend preserves used days and recalculates remainingDays automatically.
 *     Staff:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 665aaa1234567890abcdef12
 *         tenantId:
 *           type: string
 *           example: 665bbb1234567890abcdef12
 *         email:
 *           type: string
 *           example: staff@example.com
 *         phoneNumber:
 *           type: string
 *           example: "0901234567"
 *         role:
 *           type: string
 *           example: STAFF
 *         status:
 *           type: string
 *           example: ACTIVE
 *         hireDate:
 *           type: string
 *           format: date-time
 *         branchId:
 *           oneOf:
 *             - type: string
 *             - type: object
 *         warehouseId:
 *           oneOf:
 *             - type: string
 *             - type: object
 *         profile:
 *           $ref: '#/components/schemas/StaffProfile'
 *         leaveBalance:
 *           type: object
 *           properties:
 *             annualLeaveDays: { type: number, example: 15 }
 *             remainingDays: { type: number, example: 8 }
 *     Pagination:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           example: 25
 *         page:
 *           type: integer
 *           example: 1
 *         recordPerPage:
 *           type: integer
 *           example: 10
 *         totalPages:
 *           type: integer
 *           example: 3
 *     StaffValidationError:
 *       type: object
 *       required: [success, message, errors]
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Validation failed
 *         errors:
 *           type: object
 *           additionalProperties:
 *             type: string
 *           example:
 *             identificationId: Số căn cước phải gồm đúng 12 chữ số
 * /staff:
 *   post:
 *     tags:
 *       - Staff
 *     summary: Create staff
 *     description: Create a staff user in the authenticated user's tenant.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStaffRequest'
 *     responses:
 *       201:
 *         description: Staff created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Staff'
 *       400:
 *         description: Validation failed, including invalid phone numbers, identification information, or a missing/deleted paysheet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StaffValidationError'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *   get:
 *     tags:
 *       - Staff
 *     summary: Get staff list
 *     description: Get a paginated staff list scoped by tenant and requester role.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: recordPerPage
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED]
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Search by email, phone number, first name, or last name.
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [BRANCH_MANAGER, WAREHOUSE_MANAGER, STAFF]
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: warehouseId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Staff list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Staff'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 * /staff/roles:
 *   get:
 *     tags:
 *       - Staff
 *     summary: Get available staff roles
 *     description: Get staff roles that the authenticated user is allowed to assign.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available staff roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StaffRoleOption'
 *             examples:
 *               tenantOwner:
 *                 summary: Tenant owner roles
 *                 value:
 *                   data:
 *                     - value: BRANCH_MANAGER
 *                       label: Branch Manager
 *                     - value: WAREHOUSE_MANAGER
 *                       label: Warehouse Manager
 *                     - value: STAFF
 *                       label: Staff
 *               manager:
 *                 summary: Manager roles
 *                 value:
 *                   data:
 *                     - value: STAFF
 *                       label: Staff
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 * /staff/{staffId}:
 *   patch:
 *     tags:
 *       - Staff
 *     summary: Update staff
 *     description: Update staff details. Password, phone number, and manager role/workplace changes should not be changed through this endpoint.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateStaffRequest'
 *     responses:
 *       200:
 *         description: Staff updated successfully
 *       400:
 *         description: Validation failed. Identification information must be consistent, phone numbers cannot be changed here, and paySheetId must reference an active paysheet in the same tenant.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StaffValidationError'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff not found
 *   delete:
 *     tags:
 *       - Staff
 *     summary: Delete staff
 *     description: Soft delete a staff user while preserving the record, role, workplace, and linked business history. Phone number, email, identification number, tax number, address, avatar, password, and FCM tokens are anonymized or cleared; refresh tokens are revoked. Staff assigned as handover on a current or future leave request cannot be deleted. If the staff is a branch manager or warehouse manager, replacementManagerId is required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StaffManagerReplacementRequest'
 *     responses:
 *       200:
 *         description: Staff deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Staff deleted successfully
 *                 staff:
 *                   allOf:
 *                     - $ref: '#/components/schemas/StaffStatusResult'
 *                     - type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: DELETED
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff not found
 *       409:
 *         description: Staff is assigned as handover on an effective leave request
 * /staff/{staffId}/leave-balance:
 *   post:
 *     tags: [Staff]
 *     summary: Initialize a staff member's annual leave balance
 *     description: Sets annualLeaveDays and remainingDays to the same initial value. Because the User schema currently creates a default 12/12 balance, this endpoint may replace that unused default. It rejects initialization after any leave days have been used; use PATCH instead in that case.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAnnualLeaveDaysRequest'
 *     responses:
 *       201:
 *         description: Leave balance initialized successfully
 *       400:
 *         description: Invalid annualLeaveDays
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden by role hierarchy or workplace scope
 *       404:
 *         description: Staff not found in the allowed scope
 *       409:
 *         description: Leave days were already used or the balance changed concurrently
 *   patch:
 *     tags: [Staff]
 *     summary: Update a staff member's annual leave entitlement
 *     description: Preserves the number of used leave days and atomically recalculates remainingDays. For example, changing 12 annual / 5 remaining to 15 annual produces 8 remaining. Rejects a new entitlement lower than the number of days already used.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAnnualLeaveDaysRequest'
 *     responses:
 *       200:
 *         description: Annual leave entitlement and remaining balance updated successfully
 *       400:
 *         description: Invalid annualLeaveDays or entitlement is lower than used days
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden by role hierarchy or workplace scope
 *       404:
 *         description: Staff not found in the allowed scope
 *       409:
 *         description: Existing balance is inconsistent or changed concurrently
 * /staff/{staffId}/account:
 *   post:
 *     tags:
 *       - Staff
 *     summary: Create staff account
 *     description: Create a login account for an inactive staff member by setting a password and changing status to ACTIVE.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StaffAccountPasswordRequest'
 *     responses:
 *       201:
 *         description: Staff account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Staff account created successfully
 *                 staff:
 *                   $ref: '#/components/schemas/Staff'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff not found
 * /staff/{staffId}/account/password:
 *   patch:
 *     tags:
 *       - Staff
 *     summary: Update staff account password
 *     description: Update the password for an active staff account.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StaffAccountPasswordRequest'
 *     responses:
 *       200:
 *         description: Staff account password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Staff account password updated successfully
 *                 staff:
 *                   $ref: '#/components/schemas/Staff'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff not found
 * /staff/{staffId}/account/deactivate:
 *   patch:
 *     tags:
 *       - Staff
 *     summary: Deactivate staff account
 *     description: Remove the staff password and set status to INACTIVE. Staff already inactive or assigned as handover on a current or future leave request cannot be deactivated. If the staff is a branch manager or warehouse manager, replacementManagerId is required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StaffManagerReplacementRequest'
 *     responses:
 *       200:
 *         description: Staff account deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Staff account deactivated successfully
 *                 staff:
 *                   allOf:
 *                     - $ref: '#/components/schemas/StaffStatusResult'
 *                     - type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: INACTIVE
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff not found
 *       409:
 *         description: Staff is already inactive or is assigned as handover on an effective leave request
 */
function registerStaffModule(app) {
  app.post(
    "/staff",
    verifyJwt,
    requireActiveSubscription,
    authorize("staff", ["create"]),
    StaffController.create.bind(StaffController),
  );

  app.get(
    "/staff",
    verifyJwt,
    authorize("staff", "read"),
    StaffController.getStaffList.bind(StaffController),
  );

  app.patch(
    "/staff/:staffId",
    verifyJwt,
    authorize("staff", ["update"]),
    StaffController.updateStaff.bind(StaffController),
  );

  app.patch(
    "/staff/:staffId/leave-balance",
    verifyJwt,
    authorize("staff", ["update"]),
    StaffController.updateAnnualLeaveDays.bind(StaffController),
  );

  app.post(
    "/staff/:staffId/leave-balance",
    verifyJwt,
    authorize("staff", ["update"]),
    StaffController.createLeaveBalance.bind(StaffController),
  );

  app.post(
    "/staff/:staffId/account",
    verifyJwt,
    authorize("staff", ["update"]),
    StaffController.createStaffAccount.bind(StaffController),
  );

  app.patch(
    "/staff/:staffId/account/password",
    verifyJwt,
    authorize("staff", ["update"]),
    StaffController.updateStaffAccountPassword.bind(StaffController),
  );

  app.patch(
    "/staff/:staffId/account/deactivate",
    verifyJwt,
    authorize("staff", ["update"]),
    StaffController.deactivateStaffAccount.bind(StaffController),
  );

  app.delete(
    "/staff/:staffId",
    verifyJwt,
    authorize("staff", ["delete"]),
    StaffController.deleteStaff.bind(StaffController),
  );

  app.get(
    "/staff/roles",
    verifyJwt,
    authorize("staff", "read"),
    cacheResponse((req) => cacheKeys.staffRoles(req.user.role), 3600),
    StaffController.getAvailableRoles.bind(StaffController),
  );

  console.log(" Staff module registered");
}

module.exports = { registerStaffModule };
