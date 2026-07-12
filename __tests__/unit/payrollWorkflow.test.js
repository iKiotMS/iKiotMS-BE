const mongoose = require("mongoose");
const PayrollPeriod = require("../../src/models/PayrollPeriod");
const Payslip = require("../../src/models/Payslip");
const PayrollService = require("../../src/modules/payroll/service/PayrollService");

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
    const payrollPeriod = {
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

    await PayrollService.changePayrollPeriodStatus({
      tenantId,
      currentUserId,
      periodId,
      action: "SUBMIT",
      actionData: {},
    });
    expect(payrollPeriod.status).toBe("REVIEW");

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
        paymentReference: "PAY-2026-07",
        paymentNote: "Chuyển khoản",
      },
    });
    expect(payrollPeriod).toMatchObject({
      status: "PAID",
      paymentReference: "PAY-2026-07",
      paymentNote: "Chuyển khoản",
    });
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
});
