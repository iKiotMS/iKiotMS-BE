const PayrollService = require("../../src/modules/payroll/service/PayrollService");

describe("Payroll preview with multiple schedules", () => {
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

    // 5 ngày chuẩn, trong đó hai ngày chỉ làm 450/480 và 420/480 phút.
    expect(preview.basePay).toBe(2406250);

    // 500.000/ngày / 8 giờ × 2 giờ OT × hệ số 1,5.
    expect(preview.overtimePay).toBe(187500);
    expect(preview.grossSalary).toBe(2593750);

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

    expect(preview.netSalary).toBe(3043750);
    expect(preview.calculationWarnings).toEqual([]);
  });
});
