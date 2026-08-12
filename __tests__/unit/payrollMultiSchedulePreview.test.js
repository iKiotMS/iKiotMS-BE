const PayrollService = require("../../src/modules/payroll/service/PayrollService");
const PayrollSettingService = require("../../src/modules/payroll/service/PayrollSettingService");
const Holiday = require("../../src/models/Holiday");

describe("Payroll preview with multiple schedules", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("merges overlapping attendance ranges before calculating payable minutes", () => {
    const schedule = {
      _id: "schedule1",
      startAt: new Date("2026-07-06T01:00:00.000Z"),
      endAt: new Date("2026-07-06T07:00:00.000Z"),
    };
    const attendances = [
      {
        actualCheckinAt: new Date("2026-07-06T01:00:00.000Z"),
        actualCheckoutAt: new Date("2026-07-06T05:00:00.000Z"),
      },
      {
        actualCheckinAt: new Date("2026-07-06T03:00:00.000Z"),
        actualCheckoutAt: new Date("2026-07-06T07:00:00.000Z"),
      },
    ];

    expect(
      PayrollService.getSchedulePayableMinutes(schedule, attendances),
    ).toBe(360);
  });

  test("skips a fixed-salary paysheet missing salaryPerPeriod", async () => {
    const paySheetId = "64a000000000000000000011";
    const userId = "64a000000000000000000012";
    const scheduleIds = [
      "64a000000000000000000013",
      "64a000000000000000000014",
    ];
    jest.spyOn(PayrollSettingService, "getPayrollSetting").mockResolvedValue({
      data: { standardWorkingDays: 26, standardWorkingHoursPerDay: 8 },
    });
    jest.spyOn(Holiday, "find").mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    jest.spyOn(PayrollService, "gatherEmployeePayrollInfo").mockResolvedValue([
      {
        user: { _id: userId },
        paySheet: {
          _id: paySheetId,
          basicPay: { payType: "FIXED" },
        },
        workingSchedules: scheduleIds.map((_id) => ({ _id })),
        attendances: [],
      },
    ]);

    const result = await PayrollService.generatePayRoll({
      tenantId: "64a000000000000000000001",
      currentUserId: "64a000000000000000000002",
      payrollData: {
        periodStartDate: "2026-07-01",
        periodEndDate: "2026-07-31",
      },
    });

    expect(result.data.payslips).toEqual([]);
    expect(result.data.skipped).toEqual([
      {
        userId,
        paySheetId,
        scheduleIds,
        reason:
          "Cấu hình lương cố định thiếu mức lương theo kỳ (salaryPerPeriod), không thể tính lương và làm thêm giờ",
      },
    ]);
    expect(result.data.summary).toMatchObject({
      generatedCount: 0,
      skippedCount: 1,
    });

  });

  test("calculates normal shifts, overtime, monthly allowance, and late deductions", () => {
    const normalSchedules = [6, 7, 8, 9, 10].map((day) => ({
      _id: `normalSchedule${day}`,
      scheduleType: "NORMAL",
      workDate: new Date(`2026-07-${String(day).padStart(2, "0")}T00:00:00.000Z`),
      startAt: new Date(`2026-07-${String(day).padStart(2, "0")}T01:00:00.000Z`),
      endAt: new Date(`2026-07-${String(day).padStart(2, "0")}T09:00:00.000Z`),
    }));
    const overtimeSchedule = {
      _id: "overtimeSchedule",
      scheduleType: "OVERTIME",
      workDate: new Date("2026-07-10T00:00:00.000Z"),
      startAt: new Date("2026-07-10T10:00:00.000Z"),
      endAt: new Date("2026-07-10T12:00:00.000Z"),
    };
    const attendances = normalSchedules.map((schedule, index) => {
      const lateMinutes = index === 1 ? 30 : index === 2 ? 60 : 0;

      return {
        scheduleId: schedule._id,
        workDate: schedule.workDate,
        actualCheckinAt: new Date(
          new Date(schedule.startAt).getTime() + lateMinutes * 60000,
        ),
        actualCheckoutAt: schedule.endAt,
        lateMinutes,
      };
    });
    attendances.push({
      scheduleId: overtimeSchedule._id,
      workDate: overtimeSchedule.workDate,
      actualCheckinAt: overtimeSchedule.startAt,
      actualCheckoutAt: overtimeSchedule.endAt,
      lateMinutes: 0,
    });

    const preview = PayrollService.calculatePayslipPreview({
      context: {
        user: { _id: "user1", tenantId: "tenant1" },
        paySheet: {
          _id: "paysheet1",
          basicPay: {
            payType: "STANDARD_WORKING_DAY",
            standardWorkingDaySalary: 500000,
          },
          overtime: { normalDay: 1.5 },
          allowances: [
            {
              name: "Trợ cấp ăn sáng",
              enable: true,
              amountType: "FIXED_AMOUNT",
              amountValue: 500000,
            },
          ],
          deductions: [
            {
              name: "Đi muộn theo lần",
              enable: true,
              deductionType: "LATE",
              conditionType: "BY_OCCURRENCE",
              deductionValue: 25000,
            },
          ],
        },
        workingSchedules: [...normalSchedules, overtimeSchedule],
        attendances,
      },
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T23:59:59.999Z"),
      holidayByDate: {},
      payrollSetting: { standardWorkingDays: 26 },
    });

    // Rule phạt đi muộn thay thế phần giảm lương do 90 phút check-in muộn.
    expect(preview.basePay).toBe(2500000);

    // 500.000/ngày / 8 giờ × 2 giờ OT × hệ số 1,5.
    expect(preview.overtimePay).toBe(187500);
    expect(preview.grossSalary).toBe(2687500);

    expect(preview.totalWorkedDays).toBe(5);
    expect(preview.totalWorkedHours).toBe(40.5);

    expect(preview.allowance).toBe(500000);
    expect(preview.allowanceLines).toEqual([
      {
        name: "Trợ cấp ăn sáng",
        amountType: "FIXED_AMOUNT",
        amountValue: 500000,
        amount: 500000,
      },
    ]);

    expect(preview.deduction).toBe(50000);
    expect(preview.deductionLines[0]).toMatchObject({
      name: "Đi muộn theo lần",
      violationMinutes: 90,
      units: 2,
      amount: 50000,
    });

    expect(preview.netSalary).toBe(3137500);
    expect(preview.calculationWarnings).toEqual([]);
  });
});
