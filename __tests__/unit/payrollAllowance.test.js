const PayrollService = require("../../src/modules/payroll/service/PayrollService");

describe("Payroll allowance calculation", () => {
  test("calculates fixed monthly allowances", () => {
    const preview = PayrollService.calculatePayslipPreview({
      context: {
        user: { _id: "user1", tenantId: "tenant1" },
        paySheet: {
          _id: "paysheet1",
          basicPay: {
            payType: "PAY_BY_SHIFT",
            amountPerShift: 400000,
          },
          allowances: [
            {
              name: "Phụ cấp ăn trưa",
              enable: true,
              amountType: "FIXED_AMOUNT",
              amountValue: 30000,
            },
            {
              name: "Phụ cấp điện thoại",
              enable: true,
              amountType: "FIXED_AMOUNT",
              amountValue: 500000,
            },
          ],
        },
        workingSchedules: [
          {
            _id: "schedule1",
            scheduleType: "NORMAL",
            workDate: new Date("2026-07-01T00:00:00.000Z"),
            startAt: new Date("2026-07-01T01:00:00.000Z"),
            endAt: new Date("2026-07-01T09:00:00.000Z"),
          },
        ],
        attendances: [
          {
            actualCheckinAt: new Date("2026-07-01T01:00:00.000Z"),
            actualCheckoutAt: new Date("2026-07-01T09:00:00.000Z"),
          },
        ],
      },
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T23:59:59.999Z"),
      holidayByDate: {},
    });

    expect(preview.totalWorkedDays).toBe(1);
    expect(preview.allowance).toBe(530000);
    expect(preview.allowanceLines.map((item) => item.amount)).toEqual([
      30000,
      500000,
    ]);
    expect(preview.netSalary).toBe(preview.grossSalary + 530000);
  });

  test("calculates monthly percentage allowances from monthly salary", () => {
    const preview = PayrollService.calculatePayslipPreview({
      context: {
        user: { _id: "user1", tenantId: "tenant1" },
        paySheet: {
          _id: "paysheet1",
          basicPay: { payType: "FIXED", salaryPerPeriod: 12000000 },
          allowances: [
            {
              name: "Phụ cấp phần trăm",
              enable: true,
              amountType: "PERCENTAGE",
              amountValue: 10,
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

    expect(preview.allowance).toBe(1200000);
    expect(preview.calculationWarnings).toEqual([]);
    expect(preview.netSalary).toBe(13200000);
  });

  test("calculates monthly percentage allowances for shift-paid employees", () => {
    const schedule = {
      _id: "schedule1",
      scheduleType: "NORMAL",
      workDate: new Date("2026-07-01T00:00:00.000Z"),
      startAt: new Date("2026-07-01T01:00:00.000Z"),
      endAt: new Date("2026-07-01T09:00:00.000Z"),
    };
    const preview = PayrollService.calculatePayslipPreview({
      context: {
        user: { _id: "user1", tenantId: "tenant1" },
        paySheet: {
          _id: "paysheet1",
          basicPay: {
            payType: "PAY_BY_SHIFT",
            salaryPerPeriod: 12000000,
            amountPerShift: 400000,
          },
          allowances: [
            {
              name: "Daily 10%",
              enable: true,
              amountType: "PERCENTAGE",
              amountValue: 10,
            },
          ],
        },
        workingSchedules: [schedule],
        attendances: [
          {
            actualCheckinAt: schedule.startAt,
            actualCheckoutAt: schedule.endAt,
          },
        ],
      },
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T23:59:59.999Z"),
      holidayByDate: {},
    });

    expect(preview.totalWorkedDays).toBe(1);
    expect(preview.allowanceLines.map((item) => item.amount)).toEqual([
      1200000,
    ]);
    expect(preview.allowance).toBe(1200000);
  });
});
