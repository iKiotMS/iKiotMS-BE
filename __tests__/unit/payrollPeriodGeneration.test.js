const mongoose = require("mongoose");
const PayrollPeriod = require("../../src/models/PayrollPeriod");
const Payslip = require("../../src/models/Payslip");
const PayrollService = require("../../src/modules/payroll/service/PayrollService");
const PayrollSettingService = require("../../src/modules/payroll/service/PayrollSettingService");

describe("Payroll period generation", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("derives a cross-month period and saves draft payslips", async () => {
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(),
    };
    const payrollPeriodId = new mongoose.Types.ObjectId();
    const payslip = {
      userId: new mongoose.Types.ObjectId(),
      paySheetId: new mongoose.Types.ObjectId(),
      basePay: 12000000,
      grossSalary: 12000000,
      netSalary: 12000000,
    };

    jest.spyOn(PayrollSettingService, "getPayrollSetting").mockResolvedValue({
      data: { periodStartDay: 26 },
    });
    jest.spyOn(PayrollPeriod, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    jest.spyOn(PayrollService, "generatePayRoll").mockResolvedValue({
      data: {
        payslips: [payslip],
        skipped: [],
        summary: { generatedCount: 1, skippedCount: 0 },
      },
    });
    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
    jest.spyOn(PayrollPeriod, "create").mockResolvedValue([
      { _id: payrollPeriodId },
    ]);
    jest.spyOn(Payslip, "insertMany").mockResolvedValue([
      { ...payslip, payrollPeriodId, status: "DRAFT" },
    ]);

    const result = await PayrollService.generatePayrollPeriod({
      tenantId: new mongoose.Types.ObjectId(),
      currentUserId: new mongoose.Types.ObjectId(),
      payrollData: { payrollMonth: "2026-07" },
    });

    expect(PayrollService.generatePayRoll).toHaveBeenCalledWith(
      expect.objectContaining({
        payrollData: expect.objectContaining({
          periodStartDate: "2026-06-26",
          periodEndDate: "2026-07-25",
        }),
      }),
    );
    expect(PayrollPeriod.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          name: "Kỳ lương 07/2026",
          periodStart: new Date("2026-06-26T00:00:00.000Z"),
          periodEnd: new Date("2026-07-25T23:59:59.999Z"),
          status: "DRAFT",
        }),
      ],
      { session },
    );
    expect(Payslip.insertMany).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          payrollPeriodId,
          status: "DRAFT",
        }),
      ],
      { session },
    );
    expect(result.message).toBe("Tạo kỳ lương nháp thành công");
    expect(session.endSession).toHaveBeenCalled();
  });

  test("rejects a period overlapping an existing payroll period", async () => {
    const conflictingPayrollPeriodId = new mongoose.Types.ObjectId();
    jest.spyOn(PayrollSettingService, "getPayrollSetting").mockResolvedValue({
      data: { periodStartDay: 1 },
    });
    jest.spyOn(PayrollPeriod, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: conflictingPayrollPeriodId,
      }),
    });

    await expect(
      PayrollService.generatePayrollPeriod({
        tenantId: new mongoose.Types.ObjectId(),
        currentUserId: new mongoose.Types.ObjectId(),
        payrollData: { payrollMonth: "2026-07" },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      conflictingPayrollPeriodId,
    });
  });
});
