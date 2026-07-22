const mongoose = require("mongoose");
const PayrollPeriod = require("../../src/models/PayrollPeriod");
const Payslip = require("../../src/models/Payslip");
const PayrollService = require("../../src/modules/payroll/service/PayrollService");
const PayrollSettingService = require("../../src/modules/payroll/service/PayrollSettingService");

describe("Payroll period generation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-01T01:00:00.000Z"));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
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
      data: {},
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
          periodStartDate: "2026-07-01",
          periodEndDate: "2026-07-31",
        }),
      }),
    );
    expect(PayrollPeriod.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          name: "Kỳ lương 07/2026",
          // 00:00 ngày 26/06 và 23:59:59.999 ngày 25/07 tại Việt Nam,
          // 00:00 ngày 01/07 và 23:59:59.999 ngày 31/07 tại Việt Nam,
          // được lưu dưới dạng hai instant UTC tương ứng trong MongoDB.
          periodStart: new Date("2026-06-30T17:00:00.000Z"),
          periodEnd: new Date("2026-07-31T16:59:59.999Z"),
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

  test("uses the configured monthly range for payroll preview", async () => {
    jest.spyOn(PayrollSettingService, "getPayrollSetting").mockResolvedValue({
      data: {},
    });
    const previewResult = { data: { payslips: [], skipped: [] } };
    const generateSpy = jest
      .spyOn(PayrollService, "generatePayRoll")
      .mockResolvedValue(previewResult);

    const result = await PayrollService.generatePayrollMonthPreview({
      tenantId: new mongoose.Types.ObjectId(),
      currentUserId: new mongoose.Types.ObjectId(),
      payrollData: { payrollMonth: "2026-07" },
    });

    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        payrollData: {
          periodStartDate: "2026-07-01",
          periodEndDate: "2026-07-31",
          userIds: undefined,
        },
      }),
    );
    expect(result).toBe(previewResult);
  });

  test("rejects a period overlapping an existing payroll period", async () => {
    const conflictingPayrollPeriodId = new mongoose.Types.ObjectId();
    jest.spyOn(PayrollSettingService, "getPayrollSetting").mockResolvedValue({
      data: {},
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

  test("rejects a payroll period that has not ended", async () => {
    jest.spyOn(PayrollSettingService, "getPayrollSetting").mockResolvedValue({
      data: {},
    });
    const findOneSpy = jest.spyOn(PayrollPeriod, "findOne");

    await expect(
      PayrollService.generatePayrollPeriod({
        tenantId: new mongoose.Types.ObjectId(),
        currentUserId: new mongoose.Types.ObjectId(),
        payrollData: { payrollMonth: "2026-08" },
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: "Chỉ có thể tạo bảng lương sau khi kỳ lương đã kết thúc",
    });
    expect(findOneSpy).not.toHaveBeenCalled();
  });
});
