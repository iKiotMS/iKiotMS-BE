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
    // Chỉ tính phần thời gian attendance nằm bên trong khung giờ của ca.
    // Ví dụ check-in 07:30 cho ca 08:00-17:00 thì thời gian trước 08:00 bị bỏ.
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
    // payableMinutes là field tính tạm cho payroll, không được lưu trong
    // WorkingSchedule. Ca không có phút công thực tế sẽ không tạo payroll line.
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

  calculatePayslipPreview({
    context,
    periodStart,
    periodEnd,
    holidayByDate,
    payrollSetting = { standardWorkingDays: 26 },
  }) {
    const payableSchedules = this.attachPayableMinutesToSchedules(
      context.workingSchedules,
      context.attendances,
    );

    const payroll = calculatePayrollBySchedules({
      schedules: payableSchedules,
      paySheet: context.paySheet,
      holidayByDate,
      payrollSetting,
    });

    const totalWorkedMinutes = payroll.lines.reduce((total, line) => {
      return total + (line.payableMinutes || 0);
    }, 0);
    // Một ngày có thể có nhiều ca, nhưng chỉ đếm một ngày công. Ca OT không
    // tự tạo thêm ngày công vì nó đã được cộng riêng vào overtimePay.
    const totalWorkedDays = new Set(
      payableSchedules
        .filter((schedule) => schedule.scheduleType !== "OVERTIME")
        .map((schedule) =>
          new Date(schedule.workDate).toISOString().slice(0, 10),
        ),
    ).size;
    const grossSalary = payroll.grossPay;
    const bonus = 0;
    const calculationWarnings = [];

    // Allowance chỉ tính các rule đang bật. Với PERCENTAGE, phần trăm được lấy
    // trên salaryPerPeriod; FIXED_AMOUNT được cộng nguyên giá trị cấu hình.
    const allowanceLines = (context.paySheet.allowances || [])
      .filter((item) => item.enable)
      .reduce((lines, item) => {
        const amountValue = item.amountValue || 0;
        const basicPay = context.paySheet.basicPay || {};
        const monthlySalary = basicPay.salaryPerPeriod || 0;
        const amount =
          item.amountType === "PERCENTAGE"
            ? (monthlySalary * amountValue) / 100
            : amountValue;

        lines.push({
          name: item.name,
          amountType: item.amountType,
          amountValue: item.amountValue,
          amount,
        });
        return lines;
      }, []);
    const allowance = allowanceLines.reduce(
      (total, item) => total + item.amount,
      0,
    );
    // lateMinutes đã được attendance module tính sẵn sau khi áp dụng grace time.
    // Mỗi phần tử dương tương ứng một lần vi phạm để dùng cho BY_OCCURRENCE/BLOCK.
    const lateViolationMinutes = context.attendances
      .map((attendance) => Number(attendance.lateMinutes || 0))
      .filter((minutes) => minutes > 0);
    // Về sớm chưa có field lưu sẵn nên được suy ra từ schedule.endAt và checkout.
    // Ưu tiên ghép bằng scheduleId; dữ liệu cũ thiếu scheduleId sẽ ghép theo ngày.

    const earlyLeaveViolationMinutes = context.workingSchedules
      .filter((schedule) => schedule.scheduleType !== "OVERTIME")
      .map((schedule) => {
        const scheduleId = String(schedule._id || "");
        const scheduleDate = new Date(schedule.workDate)
          .toISOString()
          .slice(0, 10);
        const matchingAttendances = context.attendances.filter((attendance) => {
          if (!attendance.actualCheckoutAt) return false;
          if (attendance.scheduleId && scheduleId) {
            return String(attendance.scheduleId) === scheduleId;
          }

          const attendanceDate = new Date(
            attendance.workDate || attendance.actualCheckinAt,
          )
            .toISOString()
            .slice(0, 10);
          return attendanceDate === scheduleDate;
        });

        if (matchingAttendances.length === 0) return 0;
        // Nếu một ca có nhiều attendance, checkout muộn nhất đại diện thời điểm
        // nhân viên thực sự rời ca, tránh tính về sớm hai lần.
        const latestCheckout = Math.max(
          ...matchingAttendances.map((attendance) =>
            new Date(attendance.actualCheckoutAt).getTime(),
          ),
        );
        return Math.max(
          0,
          Math.floor(
            (new Date(schedule.endAt).getTime() - latestCheckout) / 60000,
          ),
        );
      })
      .filter((minutes) => minutes > 0);
    const enabledDeductions = (context.paySheet.deductions || []).filter(
      (item) => item.enable,
    );
    // Chỉ nhận deduction fixed amount theo schema mới. Rule percentage hoặc
    // BY_SALARY_COEFFICIENT cũ bị bỏ qua và trả warning để không trừ nhầm tiền.
    const supportedDeductions = enabledDeductions.filter(
      (item) =>
        (!item.amountType || item.amountType === "FIXED_AMOUNT") &&
        (item.deductionType === "FIXED" ||
          ["BY_OCCURRENCE", "BY_BLOCK"].includes(item.conditionType)),
    );

    if (supportedDeductions.length !== enabledDeductions.length) {
      calculationWarnings.push("UNSUPPORTED_DEDUCTION_RULE");
    }

    const deductionLines = supportedDeductions
      .map((item) => {
        let violationMinutes = [];
        let units = 1;

        if (item.deductionType === "LATE") {
          violationMinutes = lateViolationMinutes;
        } else if (item.deductionType === "EARLY_LEAVE") {
          violationMinutes = earlyLeaveViolationMinutes;
        }

        if (item.deductionType !== "FIXED") {
          // BY_OCCURRENCE: mỗi lần vi phạm = 1 unit.
          // BY_BLOCK: mỗi lần được làm tròn lên riêng, ví dụ 16 phút/15 = 2 block.
          units =
            item.conditionType === "BY_BLOCK"
              ? violationMinutes.reduce(
                  (total, minutes) =>
                    total + Math.ceil(minutes / item.blockMinutes),
                  0,
                )
              : violationMinutes.length;
        }

        return {
          name: item.name,
          deductionType: item.deductionType,
          conditionType: item.conditionType || null,
          blockMinutes:
            item.conditionType === "BY_BLOCK" ? item.blockMinutes : null,
          deductionValue: item.deductionValue,
          violationMinutes: violationMinutes.reduce(
            (total, minutes) => total + minutes,
            0,
          ),
          units,
          amount: units * (item.deductionValue || 0),
        };
      });
    const deduction = deductionLines.reduce(
      (total, item) => total + item.amount,
      0,
    );
    // Manual adjustments sẽ được cộng/trừ ở phase edit draft sau này.
    const netSalary = grossSalary + bonus + allowance - deduction;

    return {
      tenantId: context.user.tenantId,
      userId: context.user._id,
      paySheetId: context.paySheet._id,
      periodStart,
      periodEnd,
      totalWorkedDays,
      totalWorkedHours: totalWorkedMinutes / 60,
      basePay: payroll.basePay,
      overtimePay: payroll.overtimePay,
      bonus,
      allowance,
      allowanceLines,
      grossSalary,
      deduction,
      deductionLines,
      netSalary,
      calculationWarnings,
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
          status :{$nin:["CANCELLED","DELETED"]},
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

    const payrollSettingResult =
      await PayrollSettingService.getPayrollSetting(tenantId);
    const payrollSetting = payrollSettingResult.data;

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
          payrollSetting,
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
