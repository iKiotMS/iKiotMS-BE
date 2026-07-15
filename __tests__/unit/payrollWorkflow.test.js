const mongoose = require("mongoose");
const CashFlow = require("../../src/models/CashFlow");
const PayrollPeriod = require("../../src/models/PayrollPeriod");
const Payslip = require("../../src/models/Payslip");
const PayrollService = require("../../src/modules/payroll/service/PayrollService");
const NotificationService = require("../../src/services/notificationService");

describe("Payroll draft editing and status workflow", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("replaces manual adjustments and recalculates net salary", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const periodId = new mongoose.Types.ObjectId();
    const payslipId = new mongoose.Types.ObjectId();
    const currentUserId = new mongoose.Types.ObjectId();
    const payslip = {
      grossSalary: 10000000,
      bonus: 0,
      allowance: 500000,
      deduction: 200000,
      manualAdjustments: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(PayrollPeriod, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue({ status: "DRAFT" }),
    });
    jest.spyOn(Payslip, "findOne").mockResolvedValue(payslip);

    const result = await PayrollService.updateDraftPayslip({
      tenantId,
      currentUserId,
      periodId,
      payslipId,
      updateData: {
        note: "Đã kiểm tra",
        manualAdjustments: [
          { category: "SALARY_ADVANCE", name: "Ứng lương", amount: -1000000 },
          { category: "OTHER", name: "Hỗ trợ", amount: 300000 },
        ],
      },
    });

    expect(result.manualAdjustmentTotal).toBe(-700000);
    expect(payslip.netSalary).toBe(9600000);
    expect(payslip.manualAdjustments).toEqual([
      expect.objectContaining({
        category: "SALARY_ADVANCE",
        amount: -1000000,
        createdBy: currentUserId,
      }),
      expect.objectContaining({ category: "OTHER", amount: 300000 }),
    ]);
    expect(payslip.save).toHaveBeenCalled();
  });

  test("enforces DRAFT -> REVIEW -> APPROVED -> PAID and syncs payslips", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const periodId = new mongoose.Types.ObjectId();
    const currentUserId = new mongoose.Types.ObjectId();
    const cashFlowId = new mongoose.Types.ObjectId();
    const payrollPeriod = {
      name: "Kỳ lương 07/2026",
      status: "DRAFT",
      save: jest.fn().mockResolvedValue(undefined),
    };
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(),
    };
    jest.spyOn(PayrollPeriod, "findOne").mockResolvedValue(payrollPeriod);
    jest.spyOn(Payslip, "countDocuments").mockResolvedValue(2);
    jest.spyOn(Payslip, "updateMany").mockResolvedValue({ modifiedCount: 2 });
    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
    const notificationQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { _id: "payslip-1", userId: "employee-1" },
      ]),
    };
    jest.spyOn(Payslip, "find").mockReturnValue(notificationQuery);
    const aggregateQuery = {
      session: jest.fn().mockResolvedValue([{ totalCost: 25000000 }]),
    };
    jest.spyOn(Payslip, "aggregate").mockReturnValue(aggregateQuery);
    jest.spyOn(CashFlow, "create").mockResolvedValue([{ _id: cashFlowId }]);
    jest.spyOn(NotificationService, "notify").mockResolvedValue({ notified: 1 });

    await PayrollService.changePayrollPeriodStatus({
      tenantId,
      currentUserId,
      periodId,
      action: "SUBMIT",
      actionData: {},
    });
    expect(payrollPeriod.status).toBe("REVIEW");
    expect(NotificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientIds: ["employee-1"],
        type: "PAYSLIP_REVIEW",
        referenceId: "payslip-1",
      }),
    );

    await PayrollService.changePayrollPeriodStatus({
      tenantId,
      currentUserId,
      periodId,
      action: "APPROVE",
      actionData: {},
    });
    expect(payrollPeriod.status).toBe("APPROVED");

    await PayrollService.changePayrollPeriodStatus({
      tenantId,
      currentUserId,
      periodId,
      action: "MARK_PAID",
      actionData: {
        paymentReference: "VCB-2026-07",
        paymentNote: "Chuyển khoản",
      },
    });
    expect(payrollPeriod).toMatchObject({
      status: "PAID",
      paymentMethod: "CASH",
      paymentReference: "VCB-2026-07",
      paymentNote: "Chuyển khoản",
      cashFlowId,
      cashFlowReference: expect.stringMatching(/^PAYR[A-F0-9]{10}$/),
    });
    expect(CashFlow.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          tenantId,
          payrollPeriodId: periodId,
          createdBy: currentUserId,
          flowType: "EXPENSE",
          amount: 25000000,
          paymentMethod: "CASH",
          paymentReference: payrollPeriod.cashFlowReference,
          description: "Thanh toán Kỳ lương 07/2026",
        }),
      ],
      { session },
    );
    expect(Payslip.updateMany).toHaveBeenNthCalledWith(
      3,
      { tenantId, payrollPeriodId: periodId },
      { $set: { status: "PAID" } },
      { session },
    );
  });

  test("requires a reason when returning review to draft", async () => {
    await expect(
      PayrollService.changePayrollPeriodStatus({
        tenantId: new mongoose.Types.ObjectId(),
        currentUserId: new mongoose.Types.ObjectId(),
        periodId: new mongoose.Types.ObjectId(),
        action: "RETURN_TO_DRAFT",
        actionData: {},
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("lists only the authenticated employee's review or finalized payslips", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const query = {};
    query.populate = jest.fn().mockReturnValue(query);
    query.sort = jest.fn().mockReturnValue(query);
    query.skip = jest.fn().mockReturnValue(query);
    query.limit = jest.fn().mockReturnValue(query);
    query.lean = jest.fn().mockResolvedValue([{ status: "APPROVED" }]);
    jest.spyOn(Payslip, "find").mockReturnValue(query);
    jest.spyOn(Payslip, "countDocuments").mockResolvedValue(1);

    const result = await PayrollService.listMyPayslips({
      tenantId,
      userId,
      query: {},
    });

    expect(Payslip.find).toHaveBeenCalledWith({
      tenantId,
      userId,
      status: { $in: ["APPROVED", "PAID", "REVIEW"] },
    });
    expect(result).toMatchObject({
      data: [{ status: "APPROVED" }],
      pagination: { total: 1 },
    });
  });

  test("allows own REVIEW payslip detail but keeps DRAFT outside the query", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const payslipId = new mongoose.Types.ObjectId();
    const query = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ _id: payslipId, status: "REVIEW" }),
    };
    jest.spyOn(Payslip, "findOne").mockReturnValue(query);

    const result = await PayrollService.getMyPayslip({
      tenantId,
      userId,
      payslipId,
    });

    expect(Payslip.findOne).toHaveBeenCalledWith({
      _id: payslipId,
      tenantId,
      userId,
      status: { $in: ["APPROVED", "PAID", "REVIEW"] },
    });
    expect(result.status).toBe("REVIEW");
  });
});
