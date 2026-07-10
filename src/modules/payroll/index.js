const PaySheetController = require("./controller/PaySheetController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");
const PayrollSettingController = require("./controller/PayrollSettingController");

/**
 * @openapi
 * components:
 *   schemas:
 *     PaySheetBasicPay:
 *       type: object
 *       required:
 *         - payType
 *       properties:
 *         payType:
 *           type: string
 *           enum: [PAY_BY_SHIFT, PAY_BY_HOUR, STANDARD_WORKING_DAY, FIXED]
 *           example: PAY_BY_SHIFT
 *         amountPerShift:
 *           type: number
 *           example: 250000
 *         amountPerHour:
 *           type: number
 *           example: 30000
 *         salaryPerPeriod:
 *           type: number
 *           example: 8000000
 *         standardWorkingDays:
 *           type: number
 *           example: 26
 *         rates:
 *           type: object
 *           properties:
 *             holiday:
 *               type: number
 *               example: 1
 *             specialHoliday:
 *               type: number
 *               example: 3
 *     PaySheetOvertime:
 *       type: object
 *       properties:
 *         normalDay:
 *           type: number
 *           example: 1.5
 *         holiday:
 *           type: number
 *           example: 2
 *         specialHoliday:
 *           type: number
 *           example: 3
 *     PaySheetBonusTier:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: Mức 1
 *         fromValue:
 *           type: number
 *           example: 5000000
 *         rewardType:
 *           type: string
 *           enum: [FIXED_AMOUNT, PERCENTAGE]
 *           example: PERCENTAGE
 *         rewardValue:
 *           type: number
 *           example: 14
 *     PaySheetBonus:
 *       type: object
 *       required:
 *         - bonusType
 *         - calculationType
 *         - tiers
 *       properties:
 *         bonusType:
 *           type: string
 *           enum: [EMPLOYEE_REVENUE, MINIMUM_AVENUE_INCOME, BRANCH_REVENUE]
 *           example: EMPLOYEE_REVENUE
 *         calculationType:
 *           type: string
 *           enum: [GROSS_REVENUE, NET_REVENUE, COLLECTED_REVENUE]
 *           example: GROSS_REVENUE
 *         enable:
 *           type: boolean
 *           example: true
 *         tiers:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PaySheetBonusTier'
 *     PaySheetAllowance:
 *       type: object
 *       required:
 *         - name
 *         - allowancesType
 *         - amountType
 *         - amountValue
 *       properties:
 *         name:
 *           type: string
 *           example: Phụ cấp ăn trưa
 *         enable:
 *           type: boolean
 *           example: true
 *         allowancesType:
 *           type: string
 *           enum: [FIXED_DAILY, FIXED_MONTHLY]
 *           example: FIXED_DAILY
 *         amountType:
 *           type: string
 *           enum: [FIXED_AMOUNT, PERCENTAGE]
 *           example: FIXED_AMOUNT
 *         amountValue:
 *           type: number
 *           example: 30000
 *     PaySheetDeduction:
 *       type: object
 *       required:
 *         - name
 *         - deductionType
 *         - amountType
 *         - deductionValue
 *       properties:
 *         name:
 *           type: string
 *           example: Đi muộn
 *         enable:
 *           type: boolean
 *           example: true
 *         deductionType:
 *           type: string
 *           enum: [LATE, EARLY_LEAVE, FIXED]
 *           example: LATE
 *         conditionType:
 *           type: string
 *           enum: [BY_OCCURRENCE, BY_BLOCK, BY_SALARY_COEFFICIENT]
 *           example: BY_OCCURRENCE
 *         blockMinutes:
 *           type: number
 *           example: 15
 *         amountType:
 *           type: string
 *           enum: [FIXED_AMOUNT, PERCENTAGE]
 *           example: FIXED_AMOUNT
 *         deductionValue:
 *           type: number
 *           example: 20000
 *     PaySheetRequest:
 *       type: object
 *       required:
 *         - name
 *         - basicPay
 *       properties:
 *         name:
 *           type: string
 *           example: Bảng lương nhân viên bán hàng
 *         basicPay:
 *           $ref: '#/components/schemas/PaySheetBasicPay'
 *         overtime:
 *           $ref: '#/components/schemas/PaySheetOvertime'
 *         bonuses:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PaySheetBonus'
 *         allowances:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PaySheetAllowance'
 *         deductions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PaySheetDeduction'
 *     PaySheet:
 *       allOf:
 *         - $ref: '#/components/schemas/PaySheetRequest'
 *         - type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: 665aaa1234567890abcdef12
 *             tenantId:
 *               type: string
 *               example: 665bbb1234567890abcdef12
 *             createdBy:
 *               type: string
 *               example: 665ccc1234567890abcdef12
 *             createdAt:
 *               type: string
 *               format: date-time
 *             updatedAt:
 *               type: string
 *               format: date-time
 *     PaySheetPagination:
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
 *
 * /payroll/paysheets:
 *   post:
 *     tags:
 *       - Payroll
 *     summary: Create pay sheet
 *     description: Create a reusable pay sheet configuration for the authenticated tenant.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaySheetRequest'
 *     responses:
 *       201:
 *         description: Pay sheet created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *   get:
 *     tags:
 *       - Payroll
 *     summary: Get pay sheet list
 *     description: Get paginated pay sheets for the authenticated tenant.
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
 *         name: name
 *         schema:
 *           type: string
 *         description: Exact name filter.
 *     responses:
 *       200:
 *         description: Pay sheet list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PaySheet'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaySheetPagination'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *
 * /payroll/paysheets/{paySheetId}:
 *   get:
 *     tags:
 *       - Payroll
 *     summary: Get pay sheet by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paySheetId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pay sheet detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaySheet'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Pay sheet not found
 *   put:
 *     tags:
 *       - Payroll
 *     summary: Update pay sheet
 *     description: Replace a pay sheet configuration. The request body should contain the full pay sheet payload.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paySheetId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaySheetRequest'
 *     responses:
 *       200:
 *         description: Pay sheet updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Pay sheet not found
 */
function registerPayrollModule(app) {
  app.post(
    "/payroll/paysheets",
    verifyJwt,
    authorize("paysheets", ["create"]),
    PaySheetController.createPaySheet.bind(PaySheetController),
  );

  app.get(
    "/payroll/paysheets",
    verifyJwt,
    authorize("paysheets", ["read"]),
    PaySheetController.getPaySheetList.bind(PaySheetController),
  );

  app.get(
    "/payroll/paysheets/:paySheetId",
    verifyJwt,
    authorize("paysheets", ["read"]),
    PaySheetController.getPaySheetById.bind(PaySheetController),
  );

  app.put(
    "/payroll/paysheets/:paySheetId",
    verifyJwt,
    authorize("paysheets", ["update"]),
    PaySheetController.updatePaySheet.bind(PaySheetController),
  );

  app.get(
    "/payroll/settings",
    verifyJwt,
    authorize("payrollSettings", ["read"]),
    PayrollSettingController.getPayrollSetting.bind(PayrollSettingController),
  );

  app.post(
    "/payroll/settings",
    verifyJwt,
    authorize("payrollSettings", ["create"]),
    PayrollSettingController.createPayrollSetting.bind(
      PayrollSettingController,
    ),
  );

  app.put(
    "/payroll/settings",
    verifyJwt,
    authorize("payrollSettings", ["update"]),
    PayrollSettingController.updatePayrollSetting.bind(
      PayrollSettingController,
    ),
  );

  console.log(" Payroll module registered");
}

module.exports = { registerPayrollModule };
