const PaySheetController = require("./controller/PaySheetController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");
const PayrollSettingController = require("./controller/PayrollSettingController");
const PayrollController = require("./controller/PayrollController");

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
 *           enum: [PAY_BY_SHIFT, STANDARD_WORKING_DAY, FIXED]
 *           example: PAY_BY_SHIFT
 *         amountPerShift:
 *           type: number
 *           example: 250000
 *         salaryPerPeriod:
 *           type: number
 *           example: 8000000
 *           description: Salary of the whole payroll period, used by FIXED.
 *         standardWorkingDaySalary:
 *           type: number
 *           example: 500000
 *           description: Salary of one complete standard working day, used by STANDARD_WORKING_DAY.
 *         rates:
 *           type: object
 *           properties:
 *             weekend:
 *               type: number
 *               example: 2
 *             publicHoliday:
 *               type: number
 *               example: 3
 *     PaySheetOvertime:
 *       type: object
 *       properties:
 *         normalDay:
 *           type: number
 *           example: 1.5
 *         weekend:
 *           type: number
 *           example: 2
 *         publicHoliday:
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
 *         - amountType
 *         - amountValue
 *       properties:
 *         name:
 *           type: string
 *           example: Phụ cấp ăn trưa
 *         enable:
 *           type: boolean
 *           example: true
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
 *           enum: [BY_OCCURRENCE, BY_BLOCK]
 *           example: BY_OCCURRENCE
 *         blockMinutes:
 *           type: number
 *           example: 15
 *         deductionValue:
 *           type: number
 *           description: Fixed deduction amount in VND per occurrence/block, or once for FIXED.
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
 *     PayrollSetting:
 *       type: object
 *       properties:
 *         cycle: { type: string, enum: [MONTHLY] }
 *         periodStartDay: { type: integer, minimum: 1, maximum: 28 }
 *         approveAfterPeriodEndDays: { type: integer, minimum: 0 }
 *         payAfterPeriodEndDays: { type: integer, minimum: 0 }
 *         autoGenerate: { type: boolean }
 *         standardWorkingDays:
 *           type: integer
 *           minimum: 1
 *           maximum: 31
 *           default: 26
 *           description: Tenant-wide number of standard working days in one payroll period.
 *         standardWorkingHoursPerDay:
 *           type: number
 *           minimum: 1
 *           maximum: 24
 *           default: 8
 *         weekendDays:
 *           type: array
 *           items: { type: integer, minimum: 0, maximum: 6 }
 *           default: [0]
 *           description: Days treated as weekends, where 0 is Sunday and 6 is Saturday.
 *         lateGraceMinutes:
 *           type: integer
 *           minimum: 0
 *           default: 15
 *           description: IGNORE_WITHIN_GRACE; lateness within grace is ignored, otherwise all late minutes count.
 *         status: { type: string, enum: [ACTIVE, INACTIVE] }
 *
 * /payroll/preview:
 *   post:
 *     tags: [Payroll]
 *     summary: Generate a payroll preview
 *     description: Calculates payroll without saving payroll periods or payslips.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [periodStartDate, periodEndDate]
 *             properties:
 *               periodStartDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-07-01
 *               periodEndDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-07-31
 *               userIds:
 *                 type: array
 *                 description: Omit or send an empty array to preview all eligible employees.
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Payroll preview generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Tính bảng lương nháp thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     periodStart:
 *                       type: string
 *                       format: date-time
 *                     periodEnd:
 *                       type: string
 *                       format: date-time
 *                     payslips:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                             description: ID of the employee whose payroll is being previewed.
 *                             example: 665abc1234567890abcdef12
 *                           user:
 *                             type: object
 *                             description: Employee display information included only in the preview response.
 *                             properties:
 *                               profile:
 *                                 $ref: '#/components/schemas/StaffProfile'
 *                               email:
 *                                 type: string
 *                                 format: email
 *                                 nullable: true
 *                                 example: staff@example.com
 *                               phoneNumber:
 *                                 type: string
 *                                 example: "0901234567"
 *                           allowance:
 *                             type: number
 *                             description: Total calculated fixed-amount and percentage allowances.
 *                           paidLeaveDays:
 *                             type: number
 *                             description: Approved paid leave days allocated to scheduled NORMAL workdays in this period.
 *                           unpaidLeaveDays:
 *                             type: number
 *                             description: Approved unpaid leave days allocated to scheduled NORMAL workdays in this period.
 *                           paidLeavePay:
 *                             type: number
 *                             description: Pay added for approved paid leave, including prorated FIXED salary.
 *                           unpaidLeaveDeduction:
 *                             type: number
 *                             description: Amount deducted for unpaid leave; currently applies to FIXED salary.
 *                           leaveLines:
 *                             type: array
 *                             description: Paid-first leave allocation details grouped by approved leave request.
 *                             items:
 *                               type: object
 *                           allowanceLines:
 *                             type: array
 *                             items:
 *                               type: object
 *                           deduction:
 *                             type: number
 *                             description: Total calculated fixed deductions.
 *                           deductionLines:
 *                             type: array
 *                             items:
 *                               type: object
 *                           calculationWarnings:
 *                             type: array
 *                             items:
 *                               type: string
 *                               enum: [UNSUPPORTED_DEDUCTION_RULE]
 *                     skipped:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId: { type: string }
 *                           paySheetId:
 *                             type: string
 *                             nullable: true
 *                           scheduleIds:
 *                             type: array
 *                             items: { type: string }
 *                           reason:
 *                             type: string
 *                             example: Cấu hình lương cố định thiếu mức lương theo kỳ (salaryPerPeriod), không thể tính lương và làm thêm giờ
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalEmployees: { type: integer }
 *                         generatedCount: { type: integer }
 *                         skippedCount: { type: integer }
 *                         totalBasePay: { type: number }
 *                         totalOvertimePay: { type: number }
 *                         totalGrossSalary: { type: number }
 *                         totalNetSalary: { type: number }
 *       400:
 *         description: Invalid date range or user IDs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Payroll settings not found
 *       500:
 *         description: Unexpected server error
 *
 * /payroll/periods:
 *   post:
 *     tags: [Payroll]
 *     summary: Generate and save a draft payroll period
 *     description: payrollMonth is the month containing the period end date. Dates are derived from PayrollSetting.periodStartDay.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [payrollMonth]
 *             properties:
 *               payrollMonth:
 *                 type: string
 *                 pattern: '^\d{4}-(0[1-9]|1[0-2])$'
 *                 example: 2026-07
 *                 description: Tháng chứa ngày kết thúc kỳ lương.
 *               userIds:
 *                 type: array
 *                 description: Omit or send an empty array to generate payslips for all eligible employees.
 *                 items: { type: string }
 *     responses:
 *       201:
 *         description: Draft payroll period and payslips created successfully
 *       400:
 *         description: Invalid payroll month or user IDs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Payroll settings not found
 *       409:
 *         description: Payroll period overlaps an existing period
 *       422:
 *         description: No valid payslips can be generated
 *       500:
 *         description: Unexpected server error
 *   get:
 *     tags: [Payroll]
 *     summary: List payroll periods
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, REVIEW, APPROVED, PAID, CANCELLED] }
 *     responses:
 *       200:
 *         description: Payroll period list returned. Each period includes totalCost summed from all of its payslips.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       name: { type: string, example: Kỳ lương 07/2026 }
 *                       periodStart: { type: string, format: date-time }
 *                       periodEnd: { type: string, format: date-time }
 *                       status: { type: string, enum: [DRAFT, REVIEW, APPROVED, PAID, CANCELLED] }
 *                       paymentMethod: { type: string, enum: [CASH, BANK_TRANSFER, MOMO, VNPAY, SEPAY] }
 *                       paymentReference: { type: string, description: External bank or receipt reference supplied when marking paid. }
 *                       cashFlowId: { type: string, description: Linked CashFlow expense ID after payment. }
 *                       cashFlowReference: { type: string, example: PAYR9F2A1B3C4D, description: Server-generated internal payroll expense code. }
 *                       totalCost:
 *                         type: number
 *                         example: 125000000
 *                         description: Sum of netSalary across every payslip in this payroll period.
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     totalPages: { type: integer }
 *       400: { description: Invalid filters }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *
 * /payroll/periods/{periodId}:
 *   get:
 *     tags: [Payroll]
 *     summary: Get payroll period with paginated payslips
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: periodId, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200:
 *         description: Payroll period detail returned with paginated payslips and a full-period totalCost.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     payrollPeriod:
 *                       type: object
 *                       properties:
 *                         _id: { type: string }
 *                         name: { type: string, example: Kỳ lương 07/2026 }
 *                         periodStart: { type: string, format: date-time }
 *                         periodEnd: { type: string, format: date-time }
 *                         status: { type: string, enum: [DRAFT, REVIEW, APPROVED, PAID, CANCELLED] }
 *                         paymentMethod: { type: string, enum: [CASH, BANK_TRANSFER, MOMO, VNPAY, SEPAY] }
 *                         paymentReference: { type: string, description: External bank or receipt reference supplied when marking paid. }
 *                         cashFlowId: { type: string, description: Linked CashFlow expense ID after payment. }
 *                         cashFlowReference: { type: string, example: PAYR9F2A1B3C4D, description: Server-generated internal payroll expense code. }
 *                         totalCost:
 *                           type: number
 *                           example: 125000000
 *                           description: Sum of netSalary across all payslips, independent of payslip pagination.
 *                     payslips:
 *                       type: array
 *                       description: Payslips on the requested page.
 *                       items: { type: object }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                         totalPages: { type: integer }
 *       400: { description: Invalid ID or pagination }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Payroll period not found }
 *
 * /payroll/periods/{periodId}/payslips/{payslipId}:
 *   get:
 *     tags: [Payroll]
 *     summary: Get a payslip in a payroll period
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: periodId, required: true, schema: { type: string } }
 *       - { in: path, name: payslipId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Payslip returned }
 *       400: { description: Invalid IDs }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Payslip not found }
 *   patch:
 *     tags: [Payroll]
 *     summary: Edit note and manual costs of a draft payslip
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: periodId, required: true, schema: { type: string } }
 *       - { in: path, name: payslipId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note: { type: string }
 *               manualAdjustments:
 *                 type: array
 *                 description: Replaces the current list. Positive amounts add money; negative amounts deduct money.
 *                 items:
 *                   type: object
 *                   required: [name, amount]
 *                   properties:
 *                     category: { type: string, enum: [SALARY_ADVANCE, TET_BONUS, OTHER], default: OTHER }
 *                     name: { type: string }
 *                     amount: { type: number, not: { const: 0 } }
 *                     note: { type: string }
 *     responses:
 *       200: { description: Draft payslip updated and net salary recalculated }
 *       400: { description: Invalid input }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Payroll period or payslip not found }
 *       409: { description: Payroll period is not in DRAFT }
 *       422: { description: Net salary would become negative }
 *
 * /payroll/periods/{periodId}/submit:
 *   post:
 *     tags: [Payroll]
 *     summary: Submit a draft payroll period for review
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: periodId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Status changed from DRAFT to REVIEW }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Payroll period not found }
 *       409: { description: Invalid current status }
 *       422: { description: Payroll period has no payslips }
 *
 * /payroll/periods/{periodId}/return-to-draft:
 *   post:
 *     tags: [Payroll]
 *     summary: Return a payroll period under review to draft
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: periodId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties: { reason: { type: string } }
 *     responses:
 *       200: { description: Status changed from REVIEW to DRAFT }
 *       400: { description: Return reason is required }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Payroll period not found }
 *       409: { description: Invalid current status }
 *
 * /payroll/periods/{periodId}/approve:
 *   post:
 *     tags: [Payroll]
 *     summary: Approve a payroll period under review
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: periodId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Status changed from REVIEW to APPROVED }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Payroll period not found }
 *       409: { description: Invalid current status }
 *
 * /payroll/my-payslips:
 *   get:
 *     tags: [Payroll]
 *     summary: List the authenticated employee's visible payslips
 *     description: Returns only the caller's REVIEW, APPROVED, and PAID payslips. REVIEW is provisional and read-only so the employee can verify it before approval. A payslip returned to DRAFT is hidden again.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200:
 *         description: Employee payslip list returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       status: { type: string, enum: [REVIEW, APPROVED, PAID] }
 *                       netSalary: { type: number }
 *                       payrollPeriodId: { type: object }
 *                 pagination: { type: object }
 *       400: { description: Invalid pagination }
 *       401: { description: Unauthorized }
 *       403: { description: User cannot read own payslips }
 *
 * /payroll/my-payslips/{payslipId}:
 *   get:
 *     tags: [Payroll]
 *     summary: Get one visible payslip belonging to the authenticated employee
 *     description: REVIEW payslips are provisional and read-only. APPROVED and PAID payslips are finalized. DRAFT payslips are not visible to employees.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: payslipId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Employee payslip returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id: { type: string }
 *                     status: { type: string, enum: [REVIEW, APPROVED, PAID] }
 *                     netSalary: { type: number }
 *       400: { description: Invalid payslip ID }
 *       401: { description: Unauthorized }
 *       403: { description: User cannot read own payslips }
 *       404: { description: Visible payslip not found or does not belong to the user }
 *
 * /payroll/periods/{periodId}/mark-paid:
 *   post:
 *     tags: [Payroll]
 *     summary: Mark an approved payroll period as paid
 *     description: Atomically creates one tenant-level CashFlow EXPENSE for the full net salary, generates an internal PAYR reference, and changes the period and all payslips from APPROVED to PAID.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: periodId, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH]
 *                 default: CASH
 *                 description: Payroll payment is currently recorded as CASH; the server also defaults to CASH when omitted.
 *               paymentReference: { type: string, description: Optional external bank or receipt reference. The internal PAYR code is generated by the server. }
 *               paymentNote: { type: string }
 *     responses:
 *       200:
 *         description: Payroll marked paid and CashFlow expense recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id: { type: string }
 *                     status: { type: string, enum: [PAID] }
 *                     paidAt: { type: string, format: date-time }
 *                     paymentMethod: { type: string }
 *                     paymentReference: { type: string, description: External payment reference. }
 *                     cashFlowId: { type: string }
 *                     cashFlowReference: { type: string, example: PAYR9F2A1B3C4D }
 *       400: { description: Invalid payment information }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Payroll period not found }
 *       409: { description: Invalid current status or CashFlow already recorded }
 *       422: { description: Payroll period has no positive amount to pay }
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
 *
 * /payroll/settings:
 *   get:
 *     tags: [Payroll]
 *     summary: Get tenant payroll settings
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Payroll settings returned }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Payroll settings not found }
 *   post:
 *     tags: [Payroll]
 *     summary: Create tenant payroll settings
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PayrollSetting' }
 *     responses:
 *       201: { description: Payroll settings created }
 *       400: { description: Validation failed }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       409: { description: Payroll settings already exist }
 *   put:
 *     tags: [Payroll]
 *     summary: Update tenant payroll settings
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PayrollSetting' }
 *     responses:
 *       200: { description: Payroll settings updated }
 *       400: { description: Validation failed }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Payroll settings not found }
 */
function registerPayrollModule(app) {
  app.post(
    "/payroll/preview",
    verifyJwt,
    authorize("payroll", ["read"]),
    PayrollController.generatePreview.bind(PayrollController),
  );

  app.post(
    "/payroll/periods",
    verifyJwt,
    authorize("payroll", ["create"]),
    PayrollController.generatePayrollPeriod.bind(PayrollController),
  );

  app.get(
    "/payroll/periods",
    verifyJwt,
    authorize("payroll", ["read"]),
    PayrollController.listPayrollPeriods.bind(PayrollController),
  );

  app.get(
    "/payroll/periods/:periodId",
    verifyJwt,
    authorize("payroll", ["read"]),
    PayrollController.getPayrollPeriod.bind(PayrollController),
  );

  app.get(
    "/payroll/periods/:periodId/payslips/:payslipId",
    verifyJwt,
    authorize("payroll", ["read"]),
    PayrollController.getPayslip.bind(PayrollController),
  );

  app.patch(
    "/payroll/periods/:periodId/payslips/:payslipId",
    verifyJwt,
    authorize("payroll", ["update"]),
    PayrollController.updateDraftPayslip.bind(PayrollController),
  );

  app.post(
    "/payroll/periods/:periodId/submit",
    verifyJwt,
    authorize("payroll", ["update"]),
    (req, res) =>
      PayrollController.payrollPeriodAction(
        req,
        res,
        "SUBMIT",
        "Đã gửi duyệt kỳ lương",
      ),
  );

  app.post(
    "/payroll/periods/:periodId/return-to-draft",
    verifyJwt,
    authorize("payroll", ["update"]),
    (req, res) =>
      PayrollController.payrollPeriodAction(
        req,
        res,
        "RETURN_TO_DRAFT",
        "Đã trả kỳ lương về bản nháp",
      ),
  );

  app.post(
    "/payroll/periods/:periodId/approve",
    verifyJwt,
    authorize("payroll", ["update"]),
    (req, res) =>
      PayrollController.payrollPeriodAction(
        req,
        res,
        "APPROVE",
        "Đã duyệt kỳ lương",
      ),
  );

  app.post(
    "/payroll/periods/:periodId/mark-paid",
    verifyJwt,
    authorize("payroll", ["update"]),
    (req, res) =>
      PayrollController.payrollPeriodAction(
        req,
        res,
        "MARK_PAID",
        "Đã ghi nhận thanh toán kỳ lương",
      ),
  );

  app.get(
    "/payroll/my-payslips",
    verifyJwt,
    authorize("payslips", ["read_own"]),
    PayrollController.listMyPayslips.bind(PayrollController),
  );

  app.get(
    "/payroll/my-payslips/:payslipId",
    verifyJwt,
    authorize("payslips", ["read_own"]),
    PayrollController.getMyPayslip.bind(PayrollController),
  );

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
