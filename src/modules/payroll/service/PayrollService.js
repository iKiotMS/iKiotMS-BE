const Attendance = require("../../../models/Attendance");
const LeaveRequest = require("../../../models/LeaveRequest");
const PaySheet = require("../../../models/Paysheet");
const User = require("../../../models/User");
const WorkingSchedule = require("../../../models/WorkingSchedule");
const {
  calculateOverlapMinutes,
} = require("../../schedule/service/WorkingScheduleAttendanceMapper");
const GeneratePreviewPayrollDTO = require("../dto/GeneratePreviewPayrollDTO");
const {
  calculatePayrollBySchedules,
  getHolidayByDate,
} = require("./PayrollDayRateCalculator");
const PayrollSettingService = require("./PayrollSettingService");

class PayrollService {
  //===============================================================================
  //==================== Helper Functions ===========================================
  //===============================================================================

  keyById = (items) => {
    return items.reduce((result, item) => {
      result[String(item._id)] = item;
      return result;
    }, {});
  };

  groupByUserId = (items) => {
    return items.reduce((result, item) => {
      const userId = String(item.userId);
      if (!result[userId]) {
        result[userId] = [];
      }

      result[userId].push(item);
      return result;
    }, {});
  };

  groupSchedulesByUserId = (schedules) => {
    return schedules.reduce((result, schedule) => {
      const userIds = Array.isArray(schedule.userId)
        ? schedule.userId
        : [schedule.userId];

      userIds.filter(Boolean).forEach((userId) => {
        const key = String(userId?._id || userId);
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(schedule);
      });

      return result;
    }, {});
  };

  buildPeriodDate(dateValue, endOfDay = false) {
    const date = new Date(dateValue);
    if (endOfDay) {
      date.setUTCHours(23, 59, 59, 999);
    } else {
      date.setUTCHours(0, 0, 0, 0);
    }
    return date;
  }

  getSchedulePayableMinutes(schedule, attendances) {
    return attendances.reduce((total, attendance) => {
      return (
        total +
        calculateOverlapMinutes(
          attendance.actualCheckinAt,
          attendance.actualCheckoutAt,
          schedule.startAt,
          schedule.endAt,
        )
      );
    }, 0);
  }

  attachPayableMinutesToSchedules(schedules, attendances) {
    return schedules
      .map((schedule) => {
        return {
          ...schedule,
          payableMinutes: this.getSchedulePayableMinutes(
            schedule,
            attendances,
          ),
        };
      })
      .filter((schedule) => schedule.payableMinutes > 0);
  }

  calculatePayslipPreview({ context, periodStart, periodEnd, holidayByDate }) {
    const payableSchedules = this.attachPayableMinutesToSchedules(
      context.workingSchedules,
      context.attendances,
    );

    const payroll = calculatePayrollBySchedules({
      schedules: payableSchedules,
      paySheet: context.paySheet,
      holidayByDate,
    });

    const totalWorkedMinutes = payroll.lines.reduce((total, line) => {
      return total + (line.payableMinutes || 0);
    }, 0);
    const grossSalary = payroll.grossPay;
    const deduction = 0;
    const bonus = 0;
    const allowance = 0;
    const netSalary = grossSalary + bonus + allowance - deduction;

    return {
      tenantId: context.user.tenantId,
      userId: context.user._id,
      paySheetId: context.paySheet._id,
      periodStart,
      periodEnd,
      totalWorkedDays: new Set(
        payableSchedules.map((schedule) =>
          new Date(schedule.workDate).toISOString().slice(0, 10),
        ),
      ).size,
      totalWorkedHours: totalWorkedMinutes / 60,
      basePay: payroll.basePay,
      overtimePay: payroll.overtimePay,
      bonus,
      allowance,
      grossSalary,
      deduction,
      netSalary,
      lines: payroll.lines,
    };
  }

  async gatherEmployeePayrollInfo(tenantId, userIds, periodStart, periodEnd) {
    const userFilter = {
      tenantId,
      status: "ACTIVE",
      role: { $nin: ["SUPER_ADMIN", "TENANT_OWNER", "CUSTOMER"] },
    };

    if (Array.isArray(userIds) && userIds.length > 0) {
      userFilter._id = { $in: userIds };
    }

    const users = await User.find(userFilter)
      .select("_id tenantId profile email role branchId warehouseId paySheetId")
      .lean();

    const targetUserIds = users.map((user) => user._id);

    const paySheetIds = users.map((user) => user.paySheetId).filter(Boolean);
    //remove all falsy value in paysheetIds: false, 0, -0, 0n, "", null, undefined, NaN

    const [paySheets, attendances, workingSchedules, leaveRequests] =
      await Promise.all([
        PaySheet.find({
          _id: { $in: paySheetIds },
          tenantId,
          status: { $ne: "DELETED" },
        }).lean(),

        Attendance.find({
          tenantId,
          userId: { $in: targetUserIds },
          workDate: { $gte: periodStart, $lte: periodEnd },
        }).lean(),

        WorkingSchedule.find({
          tenantId,
          userId: { $in: targetUserIds },
          workDate: { $gte: periodStart, $lte: periodEnd },
        }).lean(),

        LeaveRequest.find({
          tenantId,
          userId: { $in: targetUserIds },
          status: "APPROVED",
          startDate: { $lte: periodEnd },
          endDate: { $gte: periodStart },
        }).lean(),
      ]);

    const paySheetMap = this.keyById(paySheets);
    const attendancesByUser = this.groupByUserId(attendances);
    const schedulesByUser = this.groupSchedulesByUserId(workingSchedules);
    const leaveRequestsByUser = this.groupByUserId(leaveRequests);

    const formattedData = users.map((user) => {
      const userId = user._id.toString();
      const paySheetId = user.paySheetId ? user.paySheetId.toString() : null;

      return {
        user,
        paySheet: paySheetMap[paySheetId] || null,
        attendances: attendancesByUser[userId] || [],
        workingSchedules: schedulesByUser[userId] || [],
        leaveRequests: leaveRequestsByUser[userId] || [],
      };
    });

    return formattedData;
  }

  //===============================================================================
  //==================== Main Services ===========================================
  //===============================================================================

  async generatePayRoll({ tenantId, currentUserId, payrollData }) {
    const inputData = new GeneratePreviewPayrollDTO(tenantId, payrollData);
    const validation = inputData.validate();

    if (!validation.isValid) {
      const error = new Error("Dữ liệu tạo bảng lương không hợp lệ");
      error.statusCode = validation.statusCode;
      error.errors = validation.error;
      throw error;
    }

    const periodStart = this.buildPeriodDate(inputData.periodStartDate);
    const periodEnd = this.buildPeriodDate(inputData.periodEndDate, true);

    await PayrollSettingService.getPayrollSetting(tenantId);

    const [employeePayrollInfo, holidayByDate] = await Promise.all([
      this.gatherEmployeePayrollInfo(
        tenantId,
        inputData.userIds,
        periodStart,
        periodEnd,
      ),
      getHolidayByDate({ tenantId, periodStart, periodEnd }),
    ]);

    const payslips = [];
    const skipped = [];

    for (const context of employeePayrollInfo) {
      if (!context.paySheet) {
        skipped.push({
          userId: context.user._id,
          reason: "Nhân viên chưa được gán bảng lương",
        });
        continue;
      }

      payslips.push(
        this.calculatePayslipPreview({
          context,
          periodStart,
          periodEnd,
          holidayByDate,
          currentUserId,
        }),
      );
    }

    const summary = payslips.reduce(
      (result, payslip) => {
        result.totalBasePay += payslip.basePay;
        result.totalOvertimePay += payslip.overtimePay;
        result.totalGrossSalary += payslip.grossSalary;
        result.totalNetSalary += payslip.netSalary;
        return result;
      },
      {
        totalEmployees: employeePayrollInfo.length,
        generatedCount: payslips.length,
        skippedCount: skipped.length,
        totalBasePay: 0,
        totalOvertimePay: 0,
        totalGrossSalary: 0,
        totalNetSalary: 0,
      },
    );

    return {
      message: "Tính bảng lương nháp thành công",
      data: {
        periodStart,
        periodEnd,
        payslips,
        skipped,
        summary,
      },
    };
  }
}

module.exports = new PayrollService();
