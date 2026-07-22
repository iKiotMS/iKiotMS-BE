const CreatePayrollSettingDTO = require("../../src/modules/payroll/dto/CreatePayrollSettingDTO");
const UpdatePayrollSettingDTO = require("../../src/modules/payroll/dto/UpdatePayrollSettingDTO");
const { PaySheetDTO } = require("../../src/modules/payroll/dto/PaySheetDTO");

describe("Standard working day configuration", () => {
  test("defaults tenant standard working days to 26", () => {
    const dto = new CreatePayrollSettingDTO(
      "64a000000000000000000001",
      {
        cycle: "MONTHLY",
        approveAfterPeriodEndDays: 1,
        payAfterPeriodEndDays: 5,
      },
    );

    expect(dto.validate().isValid).toBe(true);
    expect(dto.toObject().standardWorkingDays).toBe(26);
  });

  test("rejects custom payroll period start day", () => {
    const dto = new CreatePayrollSettingDTO(
      "64a000000000000000000001",
      {
        cycle: "MONTHLY",
        periodStartDay: 26,
        approveAfterPeriodEndDays: 1,
        payAfterPeriodEndDays: 5,
      },
    );

    expect(dto.validate().isValid).toBe(false);
    expect(dto.validate().error).toMatchObject({
      periodStartDay: "Không hỗ trợ ngày bắt đầu kỳ lương tùy chỉnh",
    });
  });

  test("allows updating only tenant standard working days", () => {
    const dto = new UpdatePayrollSettingDTO({ standardWorkingDays: 24 });

    expect(dto.validate().isValid).toBe(true);
    expect(dto.toObject()).toEqual({ standardWorkingDays: 24 });
  });

  test("requires standardWorkingDaySalary for daily salary paysheets", () => {
    const dto = new PaySheetDTO("tenant1", "owner1", {
      name: "Lương ngày chuẩn",
      basicPay: {
        payType: "STANDARD_WORKING_DAY",
        standardWorkingDaySalary: 500000,
      },
    });

    expect(dto.validateCreate().isValid).toBe(true);
    expect(dto.toObject().basicPay).toMatchObject({
      standardWorkingDaySalary: 500000,
    });
    expect(dto.toObject().basicPay.standardWorkingDays).toBeUndefined();
  });
});
