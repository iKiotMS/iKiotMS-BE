const mongoose = require("mongoose");
const CashFlow = require("../../src/models/CashFlow");
const PayrollPeriod = require("../../src/models/PayrollPeriod");
const Payslip = require("../../src/models/Payslip");
const PayrollService = require("../../src/modules/payroll/service/PayrollService");
const StatsQueryDTO = require("../../src/modules/stats/dto/StatsQueryDTO");

describe("Payroll CashFlow", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("accepts PAYR as a cashflow statistics prefix", () => {
    const dto = new StatsQueryDTO({ flow: "payr" });

    expect(dto.flow).toBe("PAYR");
    expect(dto.validate()).toMatchObject({ isValid: true, errors: {} });
  });

  test("CashFlow has one unique payroll expense per payroll period", () => {
    const payrollIndex = CashFlow.schema.indexes().find(
      ([fields]) => fields.payrollPeriodId === 1,
    );

    expect(payrollIndex).toEqual([
      { payrollPeriodId: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: {
          payrollPeriodId: { $exists: true },
        },
      }),
    ]);
  });

  test("does not mark an approved zero-cost payroll as paid", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const periodId = new mongoose.Types.ObjectId();
    const currentUserId = new mongoose.Types.ObjectId();
    const payrollPeriod = {
      name: "Kỳ lương 07/2026",
      status: "APPROVED",
      save: jest.fn(),
    };
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(),
    };
    const aggregateQuery = {
      session: jest.fn().mockResolvedValue([{ totalCost: 0 }]),
    };

    jest.spyOn(PayrollPeriod, "findOne").mockResolvedValue(payrollPeriod);
    jest.spyOn(Payslip, "aggregate").mockReturnValue(aggregateQuery);
    jest.spyOn(Payslip, "updateMany").mockResolvedValue({ modifiedCount: 0 });
    jest.spyOn(CashFlow, "create").mockResolvedValue([]);
    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);

    await expect(
      PayrollService.changePayrollPeriodStatus({
        tenantId,
        currentUserId,
        periodId,
        action: "MARK_PAID",
        actionData: {},
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: "Không thể thanh toán kỳ lương có tổng chi bằng 0",
    });

    expect(CashFlow.create).not.toHaveBeenCalled();
    expect(payrollPeriod.save).not.toHaveBeenCalled();
    expect(Payslip.updateMany).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });
});
