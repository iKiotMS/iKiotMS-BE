const PayrollService = require("../../src/modules/payroll/service/PayrollService");

function schedule(date, id = date) {
  return {
    _id: id,
    scheduleType: "NORMAL",
    workDate: new Date(`${date}T00:00:00.000Z`),
    startAt: new Date(`${date}T01:00:00.000Z`),
    endAt: new Date(`${date}T09:00:00.000Z`),
  };
}

function context({ basicPay, schedules, leaveRequest, attendances = [] }) {
  return {
    user: { _id: "user-1", tenantId: "tenant-1" },
    paySheet: {
      _id: "paysheet-1",
      basicPay,
      allowances: [],
      deductions: [],
    },
    workingSchedules: schedules,
    attendances,
    leaveRequests: [leaveRequest],
  };
}

const periodStart = new Date("2026-07-01T00:00:00.000Z");
const periodEnd = new Date("2026-07-31T23:59:59.999Z");
const payrollSetting = {
  standardWorkingDays: 24,
  standardWorkingHoursPerDay: 8,
  weekendDays: [0],
};

describe("Payroll approved leave requests", () => {
  test("prorates fixed salary with paid leave and records unpaid deduction", () => {
    const result = PayrollService.calculatePayslipPreview({
      context: context({
        basicPay: { payType: "FIXED", salaryPerPeriod: 12000000 },
        schedules: [schedule("2026-07-01"), schedule("2026-07-02")],
        leaveRequest: {
          _id: "leave-1",
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2026-07-02T00:00:00.000Z"),
          paidLeaveDays: 1,
          unpaidLeaveDays: 1,
        },
      }),
      periodStart,
      periodEnd,
      holidayByDate: {},
      payrollSetting,
    });

    expect(result).toMatchObject({
      paidLeaveDays: 1,
      unpaidLeaveDays: 1,
      paidLeavePay: 500000,
      unpaidLeaveDeduction: 500000,
      basePay: 500000,
      grossSalary: 500000,
      netSalary: 500000,
    });
  });

  test("pays zero fixed salary when there is no work or paid leave", () => {
    const result = PayrollService.calculatePayslipPreview({
      context: context({
        basicPay: { payType: "FIXED", salaryPerPeriod: 12000000 },
        schedules: [],
        leaveRequest: {
          _id: "leave-empty",
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2026-07-01T00:00:00.000Z"),
          paidLeaveDays: 0,
          unpaidLeaveDays: 0,
        },
      }),
      periodStart,
      periodEnd,
      holidayByDate: {},
      payrollSetting,
    });

    expect(result).toMatchObject({
      basePay: 0,
      grossSalary: 0,
      netSalary: 0,
    });
  });

  test("prorates fixed salary from actual normal attendance", () => {
    const workSchedule = schedule("2026-07-01", "fixed-schedule-1");
    const result = PayrollService.calculatePayslipPreview({
      context: context({
        basicPay: { payType: "FIXED", salaryPerPeriod: 12000000 },
        schedules: [workSchedule],
        leaveRequest: {
          _id: "leave-none",
          startDate: new Date("2026-07-02T00:00:00.000Z"),
          endDate: new Date("2026-07-02T00:00:00.000Z"),
          paidLeaveDays: 0,
          unpaidLeaveDays: 0,
        },
        attendances: [
          {
            scheduleId: "fixed-schedule-1",
            actualCheckinAt: new Date("2026-07-01T01:00:00.000Z"),
            actualCheckoutAt: new Date("2026-07-01T09:00:00.000Z"),
          },
        ],
      }),
      periodStart,
      periodEnd,
      holidayByDate: {},
      payrollSetting,
    });

    expect(result).toMatchObject({
      totalWorkedDays: 1,
      basePay: 500000,
      grossSalary: 500000,
      netSalary: 500000,
    });
  });

  test("adds paid leave to standard-working-day salary", () => {
    const result = PayrollService.calculatePayslipPreview({
      context: context({
        basicPay: {
          payType: "STANDARD_WORKING_DAY",
          standardWorkingDaySalary: 400000,
        },
        schedules: [schedule("2026-07-01")],
        leaveRequest: {
          _id: "leave-2",
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2026-07-01T00:00:00.000Z"),
          paidLeaveDays: 1,
          unpaidLeaveDays: 0,
        },
      }),
      periodStart,
      periodEnd,
      holidayByDate: {},
      payrollSetting,
    });

    expect(result).toMatchObject({
      paidLeaveDays: 1,
      paidLeavePay: 400000,
      basePay: 400000,
      netSalary: 400000,
    });
  });

  test("does not pay leave again when the employee attended that day", () => {
    const workSchedule = schedule("2026-07-01", "schedule-1");
    const result = PayrollService.calculatePayslipPreview({
      context: context({
        basicPay: {
          payType: "STANDARD_WORKING_DAY",
          standardWorkingDaySalary: 400000,
        },
        schedules: [workSchedule],
        leaveRequest: {
          _id: "leave-3",
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2026-07-01T00:00:00.000Z"),
          paidLeaveDays: 1,
          unpaidLeaveDays: 0,
        },
        attendances: [
          {
            scheduleId: "schedule-1",
            actualCheckinAt: new Date("2026-07-01T01:00:00.000Z"),
            actualCheckoutAt: new Date("2026-07-01T09:00:00.000Z"),
          },
        ],
      }),
      periodStart,
      periodEnd,
      holidayByDate: {},
      payrollSetting,
    });

    expect(result.paidLeaveDays).toBe(0);
    expect(result.paidLeavePay).toBe(0);
    expect(result.basePay).toBe(400000);
  });

  test("consumes paid days before unpaid days across payroll periods", () => {
    const allocations = PayrollService.allocateLeaveDays({
      leaveRequests: [
        {
          _id: "leave-4",
          startDate: new Date("2026-06-30T00:00:00.000Z"),
          endDate: new Date("2026-07-02T00:00:00.000Z"),
          paidLeaveDays: 2,
          unpaidLeaveDays: 1,
        },
      ],
      schedules: [
        schedule("2026-06-30"),
        schedule("2026-07-01"),
        schedule("2026-07-02"),
      ],
      periodStart,
      periodEnd,
    });

    expect(allocations[0].dates).toEqual([
      { dateKey: "2026-07-01", leaveType: "PAID", dayFraction: 1 },
      { dateKey: "2026-07-02", leaveType: "UNPAID", dayFraction: 1 },
    ]);
  });

  test("allocates fractional paid and unpaid leave within the same workday", () => {
    const allocations = PayrollService.allocateLeaveDays({
      leaveRequests: [
        {
          _id: "leave-5",
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2026-07-01T00:00:00.000Z"),
          paidLeaveDays: 0.5,
          unpaidLeaveDays: 0.5,
        },
      ],
      schedules: [schedule("2026-07-01")],
      periodStart,
      periodEnd,
    });

    expect(allocations[0].dates).toEqual([
      { dateKey: "2026-07-01", leaveType: "PAID", dayFraction: 0.5 },
      { dateKey: "2026-07-01", leaveType: "UNPAID", dayFraction: 0.5 },
    ]);
  });
});
