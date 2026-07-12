const PayrollService = require("../../src/modules/payroll/service/PayrollService");
const { PaySheetDTO } = require("../../src/modules/payroll/dto/PaySheetDTO");

describe("Payroll deduction calculation", () => {
  test("accepts fixed amounts and rejects salary-coefficient conditions", () => {
    const validDTO = new PaySheetDTO("tenant1", "owner1", {
      name: "Paysheet",
      basicPay: { payType: "PAY_BY_SHIFT", amountPerShift: 400000 },
      deductions: [
        {
          name: "Đi muộn",
          enable: true,
          deductionType: "LATE",
          conditionType: "BY_OCCURRENCE",
          deductionValue: 20000,
        },
      ],
    });
    const invalidDTO = new PaySheetDTO("tenant1", "owner1", {
      name: "Paysheet",
      basicPay: { payType: "PAY_BY_SHIFT", amountPerShift: 400000 },
      deductions: [
        {
          name: "Hệ số cũ",
          enable: true,
          deductionType: "LATE",
          conditionType: "BY_SALARY_COEFFICIENT",
          deductionValue: 10,
        },
      ],
    });

    expect(validDTO.validateCreate().isValid).toBe(true);
    expect(invalidDTO.validateCreate()).toMatchObject({
      isValid: false,
      errors: expect.arrayContaining(["Giảm trừ 1: điều kiện giảm trừ không hợp lệ"]),
    });
  });

  test("calculates fixed, late occurrence/block, and early-leave deductions", () => {
    const schedules = [
      {
        _id: "schedule1",
        scheduleType: "NORMAL",
        workDate: new Date("2026-07-01T00:00:00.000Z"),
        startAt: new Date("2026-07-01T01:00:00.000Z"),
        endAt: new Date("2026-07-01T09:00:00.000Z"),
      },
      {
        _id: "schedule2",
        scheduleType: "NORMAL",
        workDate: new Date("2026-07-02T00:00:00.000Z"),
        startAt: new Date("2026-07-02T01:00:00.000Z"),
        endAt: new Date("2026-07-02T09:00:00.000Z"),
      },
    ];
    const attendances = [
      {
        scheduleId: "schedule1",
        workDate: new Date("2026-07-01T00:00:00.000Z"),
        actualCheckinAt: new Date("2026-07-01T01:16:00.000Z"),
        actualCheckoutAt: new Date("2026-07-01T09:00:00.000Z"),
        lateMinutes: 16,
      },
      {
        scheduleId: "schedule2",
        workDate: new Date("2026-07-02T00:00:00.000Z"),
        actualCheckinAt: new Date("2026-07-02T01:05:00.000Z"),
        actualCheckoutAt: new Date("2026-07-02T08:30:00.000Z"),
        lateMinutes: 5,
      },
    ];

    const preview = PayrollService.calculatePayslipPreview({
      context: {
        user: { _id: "user1", tenantId: "tenant1" },
        paySheet: {
          _id: "paysheet1",
          basicPay: { payType: "PAY_BY_SHIFT", amountPerShift: 400000 },
          deductions: [
            {
              name: "Khoản trừ cố định",
              enable: true,
              deductionType: "FIXED",
              deductionValue: 100000,
            },
            {
              name: "Đi muộn theo lần",
              enable: true,
              deductionType: "LATE",
              conditionType: "BY_OCCURRENCE",
              deductionValue: 10000,
            },
            {
              name: "Đi muộn theo block",
              enable: true,
              deductionType: "LATE",
              conditionType: "BY_BLOCK",
              blockMinutes: 15,
              deductionValue: 20000,
            },
            {
              name: "Về sớm theo lần",
              enable: true,
              deductionType: "EARLY_LEAVE",
              conditionType: "BY_OCCURRENCE",
              deductionValue: 50000,
            },
          ],
        },
        workingSchedules: schedules,
        attendances,
      },
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T23:59:59.999Z"),
      holidayByDate: {},
    });

    expect(preview.deductionLines.map((item) => item.amount)).toEqual([
      100000,
      20000,
      60000,
      50000,
    ]);
    expect(preview.deduction).toBe(230000);
    expect(preview.netSalary).toBe(
      preview.grossSalary + preview.allowance - 230000,
    );
  });

  test("skips unsupported legacy percentage/coefficient deductions", () => {
    const preview = PayrollService.calculatePayslipPreview({
      context: {
        user: { _id: "user1", tenantId: "tenant1" },
        paySheet: {
          _id: "paysheet1",
          basicPay: { payType: "FIXED", salaryPerPeriod: 12000000 },
          deductions: [
            {
              name: "Rule cũ",
              enable: true,
              deductionType: "LATE",
              conditionType: "BY_SALARY_COEFFICIENT",
              amountType: "PERCENTAGE",
              deductionValue: 10,
            },
          ],
        },
        workingSchedules: [],
        attendances: [],
      },
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T23:59:59.999Z"),
      holidayByDate: {},
    });

    expect(preview.deduction).toBe(0);
    expect(preview.calculationWarnings).toContain(
      "UNSUPPORTED_DEDUCTION_RULE",
    );
  });
});
