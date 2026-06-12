const StaffController = require("./controller/StaffController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

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
 *           example: "079201000001"
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
 *         - password
 *         - role
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: staff@example.com
 *         phoneNumber:
 *           type: string
 *           example: "0901234567"
 *         password:
 *           type: string
 *           format: password
 *           example: "123456"
 *         role:
 *           type: string
 *           enum: [BRANCH_MANAGER, WAREHOUSE_MANAGER, STAFF]
 *           example: STAFF
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED]
 *           example: ACTIVE
 *         hireDate:
 *           type: string
 *           format: date
 *           example: 2026-06-12
 *         baseSalary:
 *           type: number
 *           example: 8000000
 *         salaryType:
 *           type: string
 *           enum: [FULL_TIME, PART_TIME]
 *           example: FULL_TIME
 *         warehouseId:
 *           type: string
 *           example: null
 *         branchId:
 *           type: string
 *           example: 665abc1234567890abcdef12
 *         profile:
 *           $ref: '#/components/schemas/StaffProfile'
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
 *             status:
 *               type: string
 *               enum: [ACTIVE, INACTIVE, SUSPENDED]
 *               example: ACTIVE
 *             hireDate:
 *               type: string
 *               format: date
 *               example: 2026-06-12
 *             baseSalary:
 *               type: number
 *               example: 9000000
 *             salaryType:
 *               type: string
 *               enum: [FULL_TIME, PART_TIME]
 *               example: FULL_TIME
 *             warehouseId:
 *               type: string
 *               example: null
 *             branchId:
 *               type: string
 *               example: 665abc1234567890abcdef12
 *             profile:
 *               $ref: '#/components/schemas/StaffProfile'
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
 *         baseSalary:
 *           type: number
 *           example: 8000000
 *         salaryType:
 *           type: string
 *           example: FULL_TIME
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
 *         description: Validation failed
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
 * /staff/{staffId}:
 *   patch:
 *     tags:
 *       - Staff
 *     summary: Update staff
 *     description: Update staff details. Password and phone number should not be changed through this endpoint.
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
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff not found
 *   delete:
 *     tags:
 *       - Staff
 *     summary: Deactivate staff
 *     description: Soft delete a staff user by setting status to INACTIVE.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Staff deactivated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff not found
 */
function registerStaffModule(app) {
  app.post(
    "/staff",
    verifyJwt,
    authorize("staff", ["create",]),
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
    authorize("staff", ["update",]),
    StaffController.updateStaff.bind(StaffController),
  );

  app.delete(
    "/staff/:staffId",
    verifyJwt,
    authorize("staff", ["delete",]),
    StaffController.deleteStaff.bind(StaffController),
  );

  console.log(" Staff module registered");
}

module.exports = { registerStaffModule };
