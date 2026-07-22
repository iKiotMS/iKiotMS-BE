const mongoose = require("mongoose");
const Attendance = require("../../../models/Attendance");
const CashFlow = require("../../../models/CashFlow");
const LeaveRequest = require("../../../models/LeaveRequest");
const PaySheet = require("../../../models/Paysheet");
const PayrollPeriod = require("../../../models/PayrollPeriod");
const Payslip = require("../../../models/Payslip");
const User = require("../../../models/User");
const WorkingSchedule = require("../../../models/WorkingSchedule");
const NotificationService = require("../../../services/notificationService");
const { REFERENCE_PREFIX } = require("../../../constants/referencePrefix");
const { generateReference } = require("../../../utils/referenceGenerator");
const GeneratePreviewPayrollDTO = require("../dto/GeneratePreviewPayrollDTO");
const GeneratePayrollDTO = require("../dto/GeneratePayrollDTO");
const ListPayrollPeriodDTO = require("../dto/ListPayrollPeriodDTO");
const PayrollPeriodActionDTO = require("../dto/PayrollPeriodActionDTO");
const UpdatePayslipDraftDTO = require("../dto/UpdatePayslipDraftDTO");
const {
  calculatePayrollBySchedules,
  getHolidayByDate,
} = require("./PayrollDayRateCalculator");
const PayrollSettingService = require("./PayrollSettingService");
const {
  VIETNAM_UTC_OFFSET_IN_MILLISECONDS,
  ONE_DAY_IN_MILLISECONDS,
} = require("../../../constants/PayrollConstants");

function mergeTimeRanges(ranges) {
  const sortedRanges = ranges
    .filter((range) => range.start < range.end)
    .sort((left, right) => left.start - right.start);

  return sortedRanges.reduce((merged, range) => {
    const lastRange = merged[merged.length - 1];

    if (!lastRange || range.start > lastRange.end) {
      merged.push({ ...range });
    } else {
      lastRange.end = Math.max(lastRange.end, range.end);
    }

    return merged;
  }, []);
}

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
    const dateParts = String(dateValue || "").split("-");
    if (dateParts.length !== 3) {
      const error = new Error("Ngày phải có định dạng YYYY-MM-DD");
      error.statusCode = 400;
      throw error;
    }

    const [year, month, day] = dateParts.map(Number);
    if (![year, month, day].every(Number.isInteger)) {
      const error = new Error("Ngày phải có định dạng YYYY-MM-DD");
      error.statusCode = 400;
      throw error;
    }

    /*
     * Ví dụ dateValue = "2026-06-26":
     * 1. Tạo 00:00 ngày 26/06 theo UTC.
     * 2. Trừ 7 giờ để được 00:00 ngày 26/06 theo giờ Việt Nam.
     * 3. MongoDB lưu mốc đó là 17:00 ngày 25/06 UTC.
     */
    const startOfDateInUtc = Date.UTC(year, month - 1, day);
    const startOfVietnamDateInUtc =
      startOfDateInUtc - VIETNAM_UTC_OFFSET_IN_MILLISECONDS;

    return new Date(
      endOfDay
        ? startOfVietnamDateInUtc + ONE_DAY_IN_MILLISECONDS - 1
        : startOfVietnamDateInUtc,
    );
  }

  buildMonthlyPeriodRange(payrollMonth, periodStartDay = 1) {
    const [year, month] = payrollMonth.split("-").map(Number);
    // Kỳ lương luôn bám theo tháng dương lịch: từ ngày 1 đến ngày cuối tháng.
    // Hai Date dưới đây chỉ dùng để làm phép tính LỊCH, chưa phải mốc lưu DB.
    const calendarPeriodStart = new Date(Date.UTC(year, month - 1, 1));
    const calendarNextPeriodStart = new Date(Date.UTC(year, month, 1));
    const calendarPeriodEnd = new Date(
      calendarNextPeriodStart.getTime() - ONE_DAY_IN_MILLISECONDS,
    );

    /*
     * Giữ riêng date key nghiệp vụ và instant UTC:
     * - periodStartDate/periodEndDate: dùng cho preview, hiển thị và tính theo ngày.
     * - periodStart/periodEnd: mốc UTC dùng để query và lưu MongoDB.
     *
     * Tuyệt đối không lấy date key bằng `periodStart.toISOString().slice(0, 10)`.
     * Đầu ngày Việt Nam nằm ở 17:00 ngày hôm trước theo UTC nên cắt ISO sẽ sai ngày.
     */
    const periodStartDate = calendarPeriodStart.toISOString().slice(0, 10);
    const periodEndDate = calendarPeriodEnd.toISOString().slice(0, 10);

    return {
      periodStartDate,
      periodEndDate,
      periodStart: this.buildPeriodDate(periodStartDate),
      periodEnd: this.buildPeriodDate(periodEndDate, true),
    };
  }

  ensurePeriodHasEnded(periodEndDate, now = new Date()) {
    const vietnamToday = new Date(
      now.getTime() + VIETNAM_UTC_OFFSET_IN_MILLISECONDS,
    )
      .toISOString()
      .slice(0, 10);

    if (periodEndDate >= vietnamToday) {
      const error = new Error(
        "Chỉ có thể tạo bảng lương sau khi kỳ lương đã kết thúc",
      );
      error.statusCode = 422;
      throw error;
    }
  }

  getSchedulePayableMinutes(schedule, attendances) {
    // Chỉ tính phần thời gian attendance nằm bên trong khung giờ của ca.
    // Ví dụ check-in 07:30 cho ca 08:00-17:00 thì thời gian trước 08:00 bị bỏ.
    const scheduleStart = new Date(schedule.startAt).getTime();
    const scheduleEnd = new Date(schedule.endAt).getTime();
    const attendanceRanges = attendances
      .filter(
        (attendance) =>
          attendance.actualCheckinAt && attendance.actualCheckoutAt,
      )
      .map((attendance) => ({
        start: Math.max(
          new Date(attendance.actualCheckinAt).getTime(),
          scheduleStart,
        ),
        end: Math.min(
          new Date(attendance.actualCheckoutAt).getTime(),
          scheduleEnd,
        ),
      }));

    // Merge trước khi cộng để phần giao nhau giữa nhiều attendance chỉ tính một lần.
    return mergeTimeRanges(attendanceRanges).reduce((total, range) => {
      return total + Math.floor((range.end - range.start) / 60000);
    }, 0);
  }

  attachPayableMinutesToSchedules(schedules, attendances) {
    // payableMinutes là field tính tạm cho payroll, không được lưu trong
    // WorkingSchedule. Ca không có phút công thực tế sẽ không tạo payroll line.
    return schedules
      .map((schedule) => {
        return {
          ...schedule,
          payableMinutes: this.getSchedulePayableMinutes(schedule, attendances),
        };
      })
      .filter((schedule) => schedule.payableMinutes > 0);
  }

  allocateLeaveDays({ leaveRequests, schedules, periodStart, periodEnd }) {
    leaveRequests = leaveRequests || [];
    schedules = schedules || [];
    // periodStart/periodEnd là instant UTC; cộng lại offset để lấy ngày Việt Nam.
    const periodStartKey = new Date(
      periodStart.getTime() + VIETNAM_UTC_OFFSET_IN_MILLISECONDS,
    )
      .toISOString()
      .slice(0, 10);
    const periodEndKey = new Date(
      periodEnd.getTime() + VIETNAM_UTC_OFFSET_IN_MILLISECONDS,
    )
      .toISOString()
      .slice(0, 10);

    // Lịch được tải cho toàn bộ khoảng của các đơn giao với kỳ lương. Nhờ vậy,
    // đơn vắt qua hai kỳ vẫn tiêu paidLeaveDays từ đầu đơn đúng một lần, thay vì
    // mỗi kỳ lại bắt đầu phân bổ paid từ đầu.
    const normalScheduleDates = new Set(
      schedules
        .filter((schedule) => schedule.scheduleType !== "OVERTIME")
        .map((schedule) =>
          new Date(schedule.workDate).toISOString().slice(0, 10),
        ),
    );

    return leaveRequests.map((leaveRequest) => {
      const requestStart = new Date(leaveRequest.startDate);
      const requestEnd = new Date(leaveRequest.endDate);
      requestStart.setUTCHours(0, 0, 0, 0);
      requestEnd.setUTCHours(0, 0, 0, 0);

      const workDates = [];
      for (
        const date = new Date(requestStart);
        date <= requestEnd;
        date.setUTCDate(date.getUTCDate() + 1)
      ) {
        const dateKey = date.toISOString().slice(0, 10);
        if (normalScheduleDates.has(dateKey)) workDates.push(dateKey);
      }

      let paidRemaining = Number(leaveRequest.paidLeaveDays || 0);
      let unpaidRemaining = Number(leaveRequest.unpaidLeaveDays || 0);
      const dates = [];

      // Quản lý chỉ lưu tổng ngày paid/unpaid, không chỉ rõ từng ngày. Policy
      // payroll là phân bổ paid từ ngày làm việc đầu tiên, hết paid mới tới unpaid.
      for (const dateKey of workDates) {
        let availableDay = 1;
        if (paidRemaining > 0) {
          const dayFraction = Math.min(availableDay, paidRemaining);
          paidRemaining -= dayFraction;
          availableDay -= dayFraction;
          if (dateKey >= periodStartKey && dateKey <= periodEndKey) {
            dates.push({ dateKey, leaveType: "PAID", dayFraction });
          }
        }

        // Một ngày có thể được duyệt nửa paid, nửa unpaid. Phần unpaid được đặt
        // ngay sau phần paid trong cùng ngày trước khi chuyển sang ngày kế tiếp.
        if (availableDay > 0 && unpaidRemaining > 0) {
          const dayFraction = Math.min(availableDay, unpaidRemaining);
          unpaidRemaining -= dayFraction;
          if (dateKey >= periodStartKey && dateKey <= periodEndKey) {
            dates.push({ dateKey, leaveType: "UNPAID", dayFraction });
          }
        }

        if (paidRemaining <= 0 && unpaidRemaining <= 0) break;
      }

      return { leaveRequest, dates };
    });
  }

  calculateLeavePayroll({
    context,
    payableSchedules,
    periodStart,
    periodEnd,
    payrollSetting,
  }) {
    const basicPay = context.paySheet.basicPay || {};
    const allocations = this.allocateLeaveDays({
      leaveRequests: context.leaveRequests,
      schedules: context.workingSchedules || [],
      periodStart,
      periodEnd,
    });
    const attendedNormalDates = new Set(
      (payableSchedules || [])
        .filter((schedule) => schedule.scheduleType !== "OVERTIME")
        .map((schedule) =>
          new Date(schedule.workDate).toISOString().slice(0, 10),
        ),
    );

    const leaveLines = allocations.map(({ leaveRequest, dates }) => {
      let paidDays = 0;
      let unpaidDays = 0;
      let paidAmount = 0;
      let deductedAmount = 0;

      const dateLines = dates.map((allocation) => {
        // Nếu nhân viên vẫn chấm công trong ngày đã xin nghỉ, tiền công thực tế
        // được ưu tiên; không cộng tiền phép hoặc trừ nghỉ không lương lần hai.
        if (attendedNormalDates.has(allocation.dateKey)) {
          return {
            date: new Date(`${allocation.dateKey}T00:00:00.000Z`),
            leaveType: allocation.leaveType,
            dayFraction: allocation.dayFraction,
            amount: 0,
            ignoredBecauseAttended: true,
          };
        }

        let amount = 0;
        if (allocation.leaveType === "PAID") {
          paidDays += allocation.dayFraction;
          if (basicPay.payType === "FIXED") {
            amount =
              ((basicPay.salaryPerPeriod || 0) /
                (payrollSetting.standardWorkingDays || 26)) *
              allocation.dayFraction;
          } else if (basicPay.payType === "STANDARD_WORKING_DAY") {
            amount =
              (basicPay.standardWorkingDaySalary ||
                (basicPay.salaryPerPeriod || 0) /
                  (basicPay.standardWorkingDays || 1)) * allocation.dayFraction;
          } else if (basicPay.payType === "PAY_BY_SHIFT") {
            // Một ngày có thể có nhiều ca NORMAL; nghỉ có lương theo ca được trả
            // đúng tổng các ca đã xếp trong ngày đó, không bao gồm ca overtime.
            const shifts = context.workingSchedules.filter(
              (schedule) =>
                schedule.scheduleType !== "OVERTIME" &&
                new Date(schedule.workDate).toISOString().slice(0, 10) ===
                  allocation.dateKey,
            );
            amount =
              shifts.length *
              Number(basicPay.amountPerShift || 0) *
              allocation.dayFraction;
          }
          paidAmount += amount;
        } else {
          unpaidDays += allocation.dayFraction;
          if (basicPay.payType === "FIXED") {
            amount =
              ((basicPay.salaryPerPeriod || 0) /
                (payrollSetting.standardWorkingDays || 26)) *
              allocation.dayFraction;
            deductedAmount += amount;
          }
        }

        return {
          date: new Date(`${allocation.dateKey}T00:00:00.000Z`),
          leaveType: allocation.leaveType,
          dayFraction: allocation.dayFraction,
          amount,
          ignoredBecauseAttended: false,
        };
      });

      return {
        leaveRequestId: leaveRequest._id,
        paidDays,
        unpaidDays,
        paidAmount,
        deductedAmount,
        dates: dateLines,
      };
    });

    return leaveLines.reduce(
      (result, line) => {
        result.paidLeaveDays += line.paidDays;
        result.unpaidLeaveDays += line.unpaidDays;
        result.paidLeavePay += line.paidAmount;
        result.unpaidLeaveDeduction += line.deductedAmount;
        return result;
      },
      {
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        paidLeavePay: 0,
        unpaidLeaveDeduction: 0,
        leaveLines,
      },
    );
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
    const leavePayroll = this.calculateLeavePayroll({
      context,
      payableSchedules,
      periodStart,
      periodEnd,
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
    const basicPay = context.paySheet.basicPay || {};
    let fixedWorkedPay = 0;

    if (basicPay.payType === "FIXED") {
      const standardMinutesPerDay =
        (payrollSetting.standardWorkingHoursPerDay || 8) * 60;
      const payableMinutesByDate = payableSchedules
        .filter((schedule) => schedule.scheduleType !== "OVERTIME")
        .reduce((result, schedule) => {
          const dateKey = new Date(schedule.workDate)
            .toISOString()
            .slice(0, 10);
          result[dateKey] =
            (result[dateKey] || 0) + Number(schedule.payableMinutes || 0);
          return result;
        }, {});

      // FIXED cũng phải có công mới hưởng lương. Mỗi ngày được quy đổi theo số
      // phút làm trên giờ chuẩn và chặn tối đa 1 công để nhiều ca không làm lương
      // vượt kỳ; paid leave được cộng riêng phía dưới như một ngày có công.
      const workedDayUnits = Object.values(payableMinutesByDate).reduce(
        (total, minutes) =>
          total + Math.min(1, minutes / standardMinutesPerDay),
        0,
      );
      fixedWorkedPay =
        workedDayUnits *
        ((basicPay.salaryPerPeriod || 0) /
          (payrollSetting.standardWorkingDays || 26));
    }

    const calculatedBasePay =
      basicPay.payType === "FIXED"
        ? fixedWorkedPay + leavePayroll.paidLeavePay
        : payroll.basePay + leavePayroll.paidLeavePay;
    const basePay =
      basicPay.payType === "FIXED"
        ? Math.min(Number(basicPay.salaryPerPeriod || 0), calculatedBasePay)
        : calculatedBasePay;
    const grossSalary = basePay + payroll.overtimePay;
    const bonus = 0;
    const calculationWarnings = [];

    //==============Allowance calc

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

    //==============Late Minutes Deuction calc

    // lateMinutes đã được attendance module tính sẵn sau khi áp dụng grace time.
    // Mỗi phần tử dương tương ứng một lần vi phạm để dùng cho BY_OCCURRENCE/BLOCK.
    const lateViolationMinutes = context.attendances
      .map((attendance) => Number(attendance.lateMinutes || 0))
      .filter((minutes) => minutes > 0);
    // Về sớm chưa có field lưu sẵn nên được suy ra từ schedule.endAt và checkout.
    // Ưu tiên ghép bằng scheduleId; dữ liệu cũ thiếu scheduleId sẽ ghép theo ngày.

    //=================Early Leave Deduction calc

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

    const deductionLines = supportedDeductions.map((item) => {
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
      user: {
        profile: context.user.profile,
        email: context.user.email,
        phoneNumber: context.user.phoneNumber,
      },
      paySheetId: context.paySheet._id,
      periodStart,
      periodEnd,
      totalWorkedDays,
      totalWorkedHours: totalWorkedMinutes / 60,
      basePay,
      overtimePay: payroll.overtimePay,
      ...leavePayroll,
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
      .select(
        "_id tenantId profile email phoneNumber role branchId warehouseId paySheetId",
      )
      .lean();

    const targetUserIds = users.map((user) => user._id);

    const paySheetIds = users.map((user) => user.paySheetId).filter(Boolean);
    //remove all falsy value in paysheetIds: false, 0, -0, 0n, "", null, undefined, NaN

    const [paySheets, attendances, leaveRequests] = await Promise.all([
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

      LeaveRequest.find({
        tenantId,
        userId: { $in: targetUserIds },
        status: "APPROVED",
        startDate: { $lte: periodEnd },
        endDate: { $gte: periodStart },
      }).lean(),
    ]);

    // Với đơn vắt qua kỳ khác, payroll cần nhìn thấy lịch từ đầu đến cuối đơn
    // để biết các ngày paid đã được phân bổ trước kỳ hiện tại hay chưa.
    const scheduleRange = leaveRequests.reduce(
      (range, leaveRequest) => ({
        start: new Date(
          Math.min(
            range.start.getTime(),
            new Date(leaveRequest.startDate).getTime(),
          ),
        ),
        end: new Date(
          Math.max(
            range.end.getTime(),
            new Date(leaveRequest.endDate).getTime(),
          ),
        ),
      }),
      { start: periodStart, end: periodEnd },
    );
    const workingSchedules = await WorkingSchedule.find({
      tenantId,
      userId: { $in: targetUserIds },
      workDate: { $gte: scheduleRange.start, $lte: scheduleRange.end },
      status: { $nin: ["CANCELLED", "DELETED"] },
    }).lean();

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

      if (
        context.paySheet.basicPay?.payType === "FIXED" &&
        !(Number(context.paySheet.basicPay.salaryPerPeriod) > 0)
      ) {
        skipped.push({
          userId: context.user._id,
          paySheetId: context.paySheet._id,
          scheduleIds: context.workingSchedules.map((schedule) => schedule._id),
          reason:
            "Cấu hình lương cố định thiếu mức lương theo kỳ (salaryPerPeriod), không thể tính lương và làm thêm giờ",
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

  async generatePayrollMonthPreview({ tenantId, currentUserId, payrollData }) {
    const inputData = new GeneratePayrollDTO(payrollData);
    const validation = inputData.validate();

    if (!validation.isValid) {
      const error = new Error("Dữ liệu xem trước kỳ lương không hợp lệ");
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const payrollSettingResult =
      await PayrollSettingService.getPayrollSetting(tenantId);
    const { periodStartDate, periodEndDate } = this.buildMonthlyPeriodRange(
      inputData.payrollMonth,
      payrollSettingResult.data.periodStartDay,
    );
    this.ensurePeriodHasEnded(periodEndDate);

    return this.generatePayRoll({
      tenantId,
      currentUserId,
      payrollData: {
        periodStartDate,
        periodEndDate,
        userIds: inputData.userIds,
      },
    });
  }

  async generatePayrollPeriod({ tenantId, currentUserId, payrollData }) {
    const inputData = new GeneratePayrollDTO(payrollData);
    const validation = inputData.validate();

    if (!validation.isValid) {
      const error = new Error("Dữ liệu tạo kỳ lương không hợp lệ");
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const payrollSettingResult =
      await PayrollSettingService.getPayrollSetting(tenantId);
    const payrollSetting = payrollSettingResult.data;
    const [year, month] = inputData.payrollMonth.split("-").map(Number);
    // payrollMonth là tháng chứa ngày kết thúc kỳ lương.
    // Ví dụ payrollMonth 2026-07, start day 26 => 26/06 đến hết 25/07.
    const { periodStartDate, periodEndDate, periodStart, periodEnd } =
      this.buildMonthlyPeriodRange(
        inputData.payrollMonth,
        payrollSetting.periodStartDay,
      );
    this.ensurePeriodHasEnded(periodEndDate);

    const overlappingPeriod = await PayrollPeriod.findOne({
      tenantId,
      status: { $ne: "CANCELLED" },
      periodStart: { $lte: periodEnd },
      periodEnd: { $gte: periodStart },
    }).lean();

    if (overlappingPeriod) {
      const error = new Error("Kỳ lương bị trùng với kỳ lương đã tồn tại");
      error.statusCode = 409;
      error.conflictingPayrollPeriodId = overlappingPeriod._id;
      throw error;
    }

    // Luôn tính lại ở server; không nhận số tiền do client gửi lên.
    const preview = await this.generatePayRoll({
      tenantId,
      currentUserId,
      payrollData: {
        periodStartDate,
        periodEndDate,
        userIds: inputData.userIds,
      },
    });

    if (preview.data.payslips.length === 0) {
      const error = new Error("Không có phiếu lương hợp lệ để tạo kỳ lương");
      error.statusCode = 422;
      error.skipped = preview.data.skipped;
      throw error;
    }

    const session = await mongoose.startSession();
    let payrollPeriod;
    let payslips;

    try {
      await session.withTransaction(async () => {
        [payrollPeriod] = await PayrollPeriod.create(
          [
            {
              tenantId,
              name: `Kỳ lương ${String(month).padStart(2, "0")}/${year}`,
              periodStart,
              periodEnd,
              status: "DRAFT",
              generatedBy: currentUserId,
            },
          ],
          { session },
        );

        payslips = await Payslip.insertMany(
          preview.data.payslips.map((payslip) => ({
            ...payslip,
            payrollPeriodId: payrollPeriod._id,
            manageBy: currentUserId,
            status: "DRAFT",
          })),
          { session },
        );
      });
    } catch (error) {
      if (error.code === 11000) {
        const conflictError = new Error("Kỳ lương đã tồn tại");
        conflictError.statusCode = 409;
        throw conflictError;
      }
      throw error;
    } finally {
      await session.endSession();
    }

    return {
      message: "Tạo kỳ lương nháp thành công",
      data: {
        payrollPeriod,
        payslips,
        skipped: preview.data.skipped,
        summary: preview.data.summary,
      },
    };
  }

  async listPayrollPeriods({ tenantId, query }) {
    const dto = new ListPayrollPeriodDTO(query);
    const validation = dto.validate();
    if (!validation.isValid) {
      const error = new Error("Bộ lọc kỳ lương không hợp lệ");
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const filter = { tenantId };
    if (dto.status) filter.status = dto.status;
    const skip = (dto.page - 1) * dto.limit;
    const [data, total] = await Promise.all([
      PayrollPeriod.find(filter)
        .sort({ periodStart: -1 })
        .skip(skip)
        .limit(dto.limit)
        .lean(),
      PayrollPeriod.countDocuments(filter),
    ]);

    // Aggregate on the server instead of summing a paginated payslip result.
    // tenantId is kept in the match even though period IDs are globally unique,
    // so this financial total remains explicitly tenant-scoped.
    const periodIds = data.map((p) => p._id);
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());
    const costAgg = await Payslip.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          payrollPeriodId: { $in: periodIds },
        },
      },
      {
        $group: {
          _id: "$payrollPeriodId",
          totalCost: { $sum: { $ifNull: ["$netSalary", 0] } },
        },
      },
    ]);

    const costMap = {};
    costAgg.forEach((item) => {
      if (item._id) {
        costMap[item._id.toString()] = item.totalCost;
      }
    });

    const dataWithCost = data.map((p) => ({
      ...p,
      totalCost: costMap[p._id.toString()] || 0,
    }));

    return {
      data: dataWithCost,
      pagination: {
        total,
        page: dto.page,
        limit: dto.limit,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }

  async getPayrollPeriod({ tenantId, periodId, query }) {
    if (!mongoose.Types.ObjectId.isValid(periodId)) {
      const error = new Error("periodId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }
    const dto = new ListPayrollPeriodDTO(query);
    dto.status = undefined;
    const validation = dto.validate();
    if (!validation.isValid) {
      const error = new Error("Phân trang không hợp lệ");
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const payrollPeriod = await PayrollPeriod.findOne({
      _id: periodId,
      tenantId,
    }).lean();
    if (!payrollPeriod) {
      const error = new Error("Không tìm thấy kỳ lương");
      error.statusCode = 404;
      throw error;
    }

    // Aggregation pipelines do not apply Mongoose's automatic string-to-ObjectId
    // casting, so normalize the path ID before sharing this filter with aggregate.
    const payrollPeriodId = new mongoose.Types.ObjectId(periodId.toString());
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());
    const payslipFilter = { tenantId: tenantObjectId, payrollPeriodId };
    const skip = (dto.page - 1) * dto.limit;
    const [payslips, total, costAgg] = await Promise.all([
      Payslip.find(payslipFilter)
        .populate("userId", "profile email")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(dto.limit)
        .lean(),
      Payslip.countDocuments(payslipFilter),
      Payslip.aggregate([
        { $match: payslipFilter },
        {
          $group: {
            _id: "$payrollPeriodId",
            totalCost: { $sum: { $ifNull: ["$netSalary", 0] } },
          },
        },
      ]),
    ]);

    // totalCost represents the whole period and must not change with page/limit.
    const totalCost = costAgg[0]?.totalCost || 0;
    const payrollPeriodWithCost = {
      ...payrollPeriod,
      totalCost,
    };

    return {
      payrollPeriod: payrollPeriodWithCost,
      payslips,
      pagination: {
        total,
        page: dto.page,
        limit: dto.limit,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }

  async getPayslip({ tenantId, periodId, payslipId }) {
    if (
      !mongoose.Types.ObjectId.isValid(periodId) ||
      !mongoose.Types.ObjectId.isValid(payslipId)
    ) {
      const error = new Error("periodId hoặc payslipId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }
    const payslip = await Payslip.findOne({
      _id: payslipId,
      payrollPeriodId: periodId,
      tenantId,
    })
      .populate("userId", "profile email")
      .lean();
    if (!payslip) {
      const error = new Error("Không tìm thấy phiếu lương");
      error.statusCode = 404;
      throw error;
    }
    return payslip;
  }

  async listMyPayslips({ tenantId, userId, query }) {
    const dto = new ListPayrollPeriodDTO(query);
    dto.status = undefined;
    const validation = dto.validate();
    if (!validation.isValid) {
      const error = new Error("Phân trang không hợp lệ");
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const filter = {
      tenantId,
      userId,
      status: { $in: ["APPROVED", "PAID", "REVIEW"] },
    };
    const skip = (dto.page - 1) * dto.limit;
    const [data, total] = await Promise.all([
      Payslip.find(filter)
        .populate("payrollPeriodId", "name periodStart periodEnd status paidAt")
        .sort({ periodEnd: -1 })
        .skip(skip)
        .limit(dto.limit)
        .lean(),
      Payslip.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page: dto.page,
        limit: dto.limit,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }

  async getMyPayslip({ tenantId, userId, payslipId }) {
    if (!mongoose.Types.ObjectId.isValid(payslipId)) {
      const error = new Error("payslipId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const payslip = await Payslip.findOne({
      _id: payslipId,
      tenantId,
      userId,
      status: { $in: ["APPROVED", "PAID", "REVIEW"] },
    })
      .populate("payrollPeriodId", "name periodStart periodEnd status paidAt")
      .lean();
    if (!payslip) {
      const error = new Error("Không tìm thấy phiếu lương có thể xem");
      error.statusCode = 404;
      throw error;
    }
    return payslip;
  }

  async updateDraftPayslip({
    tenantId,
    currentUserId,
    periodId,
    payslipId,
    updateData,
  }) {
    if (
      !mongoose.Types.ObjectId.isValid(periodId) ||
      !mongoose.Types.ObjectId.isValid(payslipId)
    ) {
      const error = new Error("periodId hoặc payslipId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }
    const dto = new UpdatePayslipDraftDTO(updateData);
    const validation = dto.validate();
    if (!validation.isValid) {
      const error = new Error("Dữ liệu cập nhật phiếu lương không hợp lệ");
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const payrollPeriod = await PayrollPeriod.findOne({
      _id: periodId,
      tenantId,
    }).lean();
    if (!payrollPeriod) {
      const error = new Error("Không tìm thấy kỳ lương");
      error.statusCode = 404;
      throw error;
    }
    if (payrollPeriod.status !== "DRAFT") {
      const error = new Error(
        "Chỉ được sửa phiếu lương khi kỳ lương ở trạng thái DRAFT",
      );
      error.statusCode = 409;
      throw error;
    }

    const payslip = await Payslip.findOne({
      _id: payslipId,
      payrollPeriodId: periodId,
      tenantId,
    });
    if (!payslip) {
      const error = new Error("Không tìm thấy phiếu lương trong kỳ này");
      error.statusCode = 404;
      throw error;
    }

    if (dto.note !== undefined) payslip.note = dto.note.trim();
    if (dto.manualAdjustments !== undefined) {
      payslip.manualAdjustments = dto.manualAdjustments.map((item) => ({
        category: item.category || "OTHER",
        name: item.name.trim(),
        amount: Number(item.amount),
        note: item.note?.trim(),
        createdBy: currentUserId,
        createdAt: new Date(),
      }));
    }

    const adjustmentTotal = payslip.manualAdjustments.reduce(
      (total, item) => total + Number(item.amount || 0),
      0,
    );
    payslip.netSalary =
      Number(payslip.grossSalary || 0) +
      Number(payslip.bonus || 0) +
      Number(payslip.allowance || 0) -
      Number(payslip.deduction || 0) +
      adjustmentTotal;
    if (payslip.netSalary < 0) {
      const error = new Error("Tổng điều chỉnh làm lương thực nhận nhỏ hơn 0");
      error.statusCode = 422;
      throw error;
    }

    payslip.manageBy = currentUserId;
    await payslip.save();
    return { payslip, manualAdjustmentTotal: adjustmentTotal };
  }

  async changePayrollPeriodStatus({
    tenantId,
    currentUserId,
    periodId,
    action,
    actionData,
  }) {
    if (!mongoose.Types.ObjectId.isValid(periodId)) {
      const error = new Error("periodId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }
    const transitions = {
      SUBMIT: { from: "DRAFT", to: "REVIEW" },
      RETURN_TO_DRAFT: { from: "REVIEW", to: "DRAFT" },
      APPROVE: { from: "REVIEW", to: "APPROVED" },
      MARK_PAID: { from: "APPROVED", to: "PAID" },
    };
    const transition = transitions[action];
    const dto = new PayrollPeriodActionDTO(actionData);
    const validation = dto.validate(action);
    if (!transition || !validation.isValid) {
      const error = new Error("Dữ liệu chuyển trạng thái không hợp lệ");
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }

    const payrollPeriod = await PayrollPeriod.findOne({
      _id: periodId,
      tenantId,
    });
    if (!payrollPeriod) {
      const error = new Error("Không tìm thấy kỳ lương");
      error.statusCode = 404;
      throw error;
    }
    if (payrollPeriod.status !== transition.from) {
      const error = new Error(
        `Chỉ có thể thực hiện ${action} khi kỳ lương ở trạng thái ${transition.from}`,
      );
      error.statusCode = 409;
      throw error;
    }
    if (
      action === "SUBMIT" &&
      (await Payslip.countDocuments({
        tenantId,
        payrollPeriodId: periodId,
      })) === 0
    ) {
      const error = new Error("Kỳ lương chưa có phiếu lương để gửi duyệt");
      error.statusCode = 422;
      throw error;
    }

    const now = new Date();
    payrollPeriod.status = transition.to;
    if (action === "SUBMIT") {
      payrollPeriod.submittedBy = currentUserId;
      payrollPeriod.submittedAt = now;
    } else if (action === "RETURN_TO_DRAFT") {
      payrollPeriod.returnedBy = currentUserId;
      payrollPeriod.returnedAt = now;
      payrollPeriod.returnReason = dto.reason.trim();
    } else if (action === "APPROVE") {
      payrollPeriod.approvedBy = currentUserId;
      payrollPeriod.approvedAt = now;
    } else if (action === "MARK_PAID") {
      payrollPeriod.paidBy = currentUserId;
      payrollPeriod.paidAt = now;
      // Payroll payout is recorded as CASH for the current MVP. Keep this
      // server-owned so a client cannot label an unintegrated bank/SePay payout.
      payrollPeriod.paymentMethod = "CASH";
      payrollPeriod.paymentReference = dto.paymentReference?.trim();
      payrollPeriod.paymentNote = dto.paymentNote?.trim();
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (action === "MARK_PAID") {
          const tenantObjectId = new mongoose.Types.ObjectId(
            tenantId.toString(),
          );
          const payrollPeriodObjectId = new mongoose.Types.ObjectId(
            periodId.toString(),
          );

          // Tổng chi phải được đọc lại bên trong cùng transaction với thao tác
          // PAID. Không dùng totalCost từ API list/detail vì đó chỉ là dữ liệu
          // trả về ở request khác và có thể đã cũ.
          const totalRows = await Payslip.aggregate([
            {
              $match: {
                tenantId: tenantObjectId,
                payrollPeriodId: payrollPeriodObjectId,
              },
            },
            {
              $group: {
                _id: "$payrollPeriodId",
                totalCost: { $sum: { $ifNull: ["$netSalary", 0] } },
              },
            },
          ]).session(session);
          const totalCost = totalRows[0]?.totalCost || 0;

          if (totalCost <= 0) {
            const error = new Error(
              "Không thể thanh toán kỳ lương có tổng chi bằng 0",
            );
            error.statusCode = 422;
            throw error;
          }

          const cashFlowReference = generateReference(
            REFERENCE_PREFIX.PAYROLL,
          );
          const [payrollCashFlow] = await CashFlow.create(
            [
              {
                tenantId,
                payrollPeriodId: periodId,
                createdBy: currentUserId,
                flowType: "EXPENSE",
                amount: totalCost,
                paymentMethod: payrollPeriod.paymentMethod,
                paymentReference: cashFlowReference,
                description: `Thanh toán ${payrollPeriod.name}`,
              },
            ],
            { session },
          );

          // status PAID và dấu vết CashFlow được commit cùng nhau. cashFlowId là
          // quan hệ chuẩn; cashFlowReference được snapshot để UI hiển thị nhanh
          // mà không phải thêm một API đọc CashFlow chỉ để lấy mã PAYR.
          payrollPeriod.cashFlowId = payrollCashFlow._id;
          payrollPeriod.cashFlowReference = cashFlowReference;
        }

        await payrollPeriod.save({ session });
        await Payslip.updateMany(
          { tenantId, payrollPeriodId: periodId },
          { $set: { status: transition.to } },
          { session },
        );
      });
    } catch (error) {
      if (action === "MARK_PAID" && error.code === 11000) {
        const conflictError = new Error(
          "CashFlow của kỳ lương này đã được ghi nhận",
        );
        conflictError.statusCode = 409;
        throw conflictError;
      }
      throw error;
    } finally {
      await session.endSession();
    }

    // REVIEW là cửa sổ để nhân viên kiểm tra phiếu tạm tính và phản hồi trước
    // khi APPROVED chốt số liệu. Mỗi lần re-submit từ DRAFT đều gửi lại thông báo
    // để nhân viên biết phiên bản đã chỉnh sửa có thể được kiểm tra lại.
    // RETURN_TO_DRAFT không gửi noti và bộ lọc my-payslips tự ẩn phiếu DRAFT.
    //
    // Bọc try/catch: notify() tự nuốt lỗi của nó, nhưng truy vấn Payslip.find
    // bên dưới thì không. Kỳ lương đã được chốt và commit ở trên rồi — không thể
    // để việc gửi thông báo thất bại kéo theo cả thao tác chốt lương.
    const notificationByAction = {
      SUBMIT: {
        type: "PAYSLIP_REVIEW",
        title: "Phiếu lương tạm tính đang chờ kiểm tra",
        description:
          "Phiếu lương tạm tính đã sẵn sàng. Vui lòng kiểm tra và phản hồi trước khi được duyệt.",
      },
      APPROVE: {
        type: "PAYSLIP_APPROVED",
        title: "Phiếu lương đã được duyệt",
        description: "Phiếu lương kỳ này đã được duyệt.",
      },
      MARK_PAID: {
        type: "PAYSLIP_PAID",
        title: "Lương đã được thanh toán",
        description:
          "Lương kỳ này đã được chi trả.",
      },
    };
    const notification = notificationByAction[action];

    if (notification) {
      try {
        const payslips = await Payslip.find({
          tenantId,
          payrollPeriodId: periodId,
        })
          .select("_id userId")
          .lean();

        for (const payslip of payslips) {
          await NotificationService.notify({
            tenantId,
            recipientIds: [payslip.userId],
            ...notification,
            link: `/staffs/payroll/${payslip._id}`,
            referenceId: payslip._id,
          });
        }
      } catch (error) {
        console.error(
          "[PayrollService] Không gửi được thông báo phiếu lương:",
          error.message,
        );
      }
    }

    return payrollPeriod;
  }
}

module.exports = new PayrollService();
