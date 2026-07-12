const {
  calculateSchedulePay,
  calculatePayrollBySchedules,
} = require("../../src/modules/payroll/service/PayrollDayRateCalculator");

describe("PayrollDayRateCalculator", () => {
  test("calculates normal schedule pay from worked minutes and holiday rate", () => {
    const line = calculateSchedulePay({
      schedule: {
        _id: "schedule1",
        scheduleType: "NORMAL",
        workDate: new Date("2026-07-01T00:00:00.000Z"),
        startAt: new Date("2026-07-01T01:00:00.000Z"),
        endAt: new Date("2026-07-01T05:00:00.000Z"),
        payableMinutes: 120,
      },
      paySheet: {
        basicPay: {
          payType: "PAY_BY_SHIFT",
          amountPerShift: 200000,
          rates: {
            weekend: 2,
            publicHoliday: 3,
          },
        },
      },
      holiday: {
        name: "Public holiday",
        type: "PUBLIC_HOLIDAY",
      },
    });

    expect(line).toMatchObject({
      dayType: "HOLIDAY",
      rate: 3,
      scheduledMinutes: 240,
      payableMinutes: 120,
      amount: 300000,
      holidayName: "Public holiday",
    });
  });

  test("separates base pay and overtime pay by schedule type", () => {
    const result = calculatePayrollBySchedules({
      schedules: [
        {
          _id: "normalSchedule",
          scheduleType: "NORMAL",
          workDate: new Date("2026-07-01T00:00:00.000Z"),
          startAt: new Date("2026-07-01T01:00:00.000Z"),
          endAt: new Date("2026-07-01T05:00:00.000Z"),
          payableMinutes: 240,
        },
        {
          _id: "overtimeSchedule",
          scheduleType: "OVERTIME",
          workDate: new Date("2026-07-01T00:00:00.000Z"),
          startAt: new Date("2026-07-01T05:00:00.000Z"),
          endAt: new Date("2026-07-01T07:00:00.000Z"),
          payableMinutes: 60,
        },
      ],
      paySheet: {
        basicPay: {
          payType: "PAY_BY_SHIFT",
          amountPerShift: 200000,
          rates: {
            weekend: 2,
            publicHoliday: 3,
          },
        },
        overtime: {
          normalDay: 1.5,
          weekend: 2,
          publicHoliday: 3,
        },
      },
      holidayByDate: {},
    });

    expect(result.basePay).toBe(200000);
    expect(result.overtimePay).toBe(150000);
    expect(result.grossPay).toBe(350000);
  });

  test("does not apply a built-in rate for a company holiday", () => {
    const line = calculateSchedulePay({
      schedule: {
        _id: "companyHolidaySchedule",
        scheduleType: "NORMAL",
        workDate: new Date("2026-07-01T00:00:00.000Z"),
        startAt: new Date("2026-07-01T01:00:00.000Z"),
        endAt: new Date("2026-07-01T05:00:00.000Z"),
        payableMinutes: 240,
      },
      paySheet: {
        basicPay: {
          payType: "PAY_BY_SHIFT",
          amountPerShift: 200000,
          rates: {
            weekend: 2,
            publicHoliday: 3,
          },
        },
      },
      holiday: {
        name: "Company anniversary",
        type: "COMPANY_HOLIDAY",
      },
    });

    expect(line).toMatchObject({
      dayType: "NORMAL",
      rate: 1,
      amount: 200000,
      holidayName: null,
    });
  });

  test("uses the weekend rate on Sunday", () => {
    const line = calculateSchedulePay({
      schedule: {
        _id: "sundaySchedule",
        scheduleType: "NORMAL",
        workDate: new Date("2026-07-05T00:00:00.000Z"),
        startAt: new Date("2026-07-05T01:00:00.000Z"),
        endAt: new Date("2026-07-05T05:00:00.000Z"),
        payableMinutes: 240,
      },
      paySheet: {
        basicPay: {
          payType: "PAY_BY_SHIFT",
          amountPerShift: 200000,
          rates: { weekend: 2 },
        },
      },
      holiday: null,
    });

    expect(line).toMatchObject({
      dayType: "WEEKEND",
      rate: 2,
      amount: 400000,
    });
  });

  test("treats Saturday as a normal day under the current weekend policy", () => {
    const line = calculateSchedulePay({
      schedule: {
        _id: "saturdaySchedule",
        scheduleType: "NORMAL",
        workDate: new Date("2026-07-04T00:00:00.000Z"),
        startAt: new Date("2026-07-04T01:00:00.000Z"),
        endAt: new Date("2026-07-04T05:00:00.000Z"),
        payableMinutes: 240,
      },
      paySheet: {
        basicPay: {
          payType: "PAY_BY_SHIFT",
          amountPerShift: 200000,
          rates: { weekend: 2 },
        },
      },
      holiday: null,
    });

    expect(line).toMatchObject({
      dayType: "NORMAL",
      rate: 1,
      amount: 200000,
    });
  });

  test("leaves fixed normal pay for PayrollService to prorate", () => {
    const result = calculatePayrollBySchedules({
      schedules: [
        {
          _id: "fixedSchedule1",
          scheduleType: "NORMAL",
          workDate: new Date("2026-07-01T00:00:00.000Z"),
          startAt: new Date("2026-07-01T01:00:00.000Z"),
          endAt: new Date("2026-07-01T09:00:00.000Z"),
          payableMinutes: 480,
        },
        {
          _id: "fixedSchedule2",
          scheduleType: "NORMAL",
          workDate: new Date("2026-07-02T00:00:00.000Z"),
          startAt: new Date("2026-07-02T01:00:00.000Z"),
          endAt: new Date("2026-07-02T09:00:00.000Z"),
          payableMinutes: 480,
        },
      ],
      paySheet: {
        basicPay: { payType: "FIXED", salaryPerPeriod: 12000000 },
      },
      holidayByDate: {},
    });

    expect(result.basePay).toBe(0);
    expect(result.grossPay).toBe(0);
    expect(result.lines.map((line) => line.amount)).toEqual([0, 0]);
  });

  test("does not prefill fixed salary when there are no payable schedules", () => {
    const result = calculatePayrollBySchedules({
      schedules: [],
      paySheet: {
        basicPay: { payType: "FIXED", salaryPerPeriod: 12000000 },
      },
      holidayByDate: {},
    });

    expect(result).toMatchObject({
      basePay: 0,
      overtimePay: 0,
      grossPay: 0,
      lines: [],
    });
  });

  test("derives fixed-salary overtime from standard days and an 8-hour day", () => {
    const result = calculatePayrollBySchedules({
      schedules: [
        {
          _id: "fixedOvertimeSchedule",
          scheduleType: "OVERTIME",
          workDate: new Date("2026-07-01T00:00:00.000Z"),
          startAt: new Date("2026-07-01T10:00:00.000Z"),
          endAt: new Date("2026-07-01T12:00:00.000Z"),
          payableMinutes: 120,
        },
      ],
      paySheet: {
        basicPay: {
          payType: "FIXED",
          salaryPerPeriod: 12000000,
        },
        overtime: { normalDay: 1.5 },
      },
      payrollSetting: { standardWorkingDays: 24 },
      holidayByDate: {},
    });

    expect(result.basePay).toBe(0);
    expect(result.overtimePay).toBe(187500);
    expect(result.grossPay).toBe(187500);
  });

  test("uses standardWorkingDaySalary directly for daily pay and overtime", () => {
    const result = calculatePayrollBySchedules({
      schedules: [
        {
          _id: "normalStandardDay",
          scheduleType: "NORMAL",
          workDate: new Date("2026-07-01T00:00:00.000Z"),
          startAt: new Date("2026-07-01T01:00:00.000Z"),
          endAt: new Date("2026-07-01T09:00:00.000Z"),
          payableMinutes: 480,
        },
        {
          _id: "standardDayOvertime",
          scheduleType: "OVERTIME",
          workDate: new Date("2026-07-01T00:00:00.000Z"),
          startAt: new Date("2026-07-01T10:00:00.000Z"),
          endAt: new Date("2026-07-01T12:00:00.000Z"),
          payableMinutes: 120,
        },
      ],
      paySheet: {
        basicPay: {
          payType: "STANDARD_WORKING_DAY",
          standardWorkingDaySalary: 500000,
        },
        overtime: { normalDay: 1.5 },
      },
      holidayByDate: {},
    });

    expect(result.basePay).toBe(500000);
    expect(result.overtimePay).toBe(187500);
    expect(result.grossPay).toBe(687500);
  });
});
