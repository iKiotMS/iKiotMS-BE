const mongoose = require("mongoose");
const Attendance = require("../../../models/Attendance");
const LeaveRequest = require("../../../models/LeaveRequest");
const PaySheet = require("../../../models/Paysheet");
const PayrollPeriod = require("../../../models/PayrollPeriod");
const Payslip = require("../../../models/Payslip");
const User = require("../../../models/User");
const WorkingSchedule = require("../../../models/WorkingSchedule");
const NotificationService = require("../../../services/notificationService");
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
      .select(
        "_id tenantId profile email phoneNumber role branchId warehouseId paySheetId",
      )
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
          status: { $nin: ["CANCELLED", "DELETED"] },
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
    const periodStartDay = payrollSetting.periodStartDay || 1;

    // payrollMonth là tháng chứa ngày kết thúc kỳ lương.
    // Ví dụ payrollMonth 2026-07, start day 26 => 26/06 đến hết 25/07.
    const periodStart =
      periodStartDay === 1
        ? new Date(Date.UTC(year, month - 1, 1))
        : new Date(Date.UTC(year, month - 2, periodStartDay));
    const nextPeriodStart =
      periodStartDay === 1
        ? new Date(Date.UTC(year, month, 1))
        : new Date(Date.UTC(year, month - 1, periodStartDay));
    const periodEnd = new Date(nextPeriodStart.getTime() - 1);

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
        periodStartDate: periodStart.toISOString().slice(0, 10),
        periodEndDate: periodEnd.toISOString().slice(0, 10),
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

    const payslipFilter = { tenantId, payrollPeriodId: periodId };
    const skip = (dto.page - 1) * dto.limit;
    const [payslips, total] = await Promise.all([
      Payslip.find(payslipFilter)
        .populate("userId", "profile email")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(dto.limit)
        .lean(),
      Payslip.countDocuments(payslipFilter),
    ]);

    return {
      payrollPeriod,
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
      status: { $in: ["APPROVED", "PAID"] },
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
      status: { $in: ["APPROVED", "PAID"] },
    })
      .populate("payrollPeriodId", "name periodStart periodEnd status paidAt")
      .lean();
    if (!payslip) {
      const error = new Error("Không tìm thấy phiếu lương đã được công bố");
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
      payrollPeriod.paymentReference = dto.paymentReference?.trim();
      payrollPeriod.paymentNote = dto.paymentNote?.trim();
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await payrollPeriod.save({ session });
        await Payslip.updateMany(
          { tenantId, payrollPeriodId: periodId },
          { $set: { status: transition.to } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    // Chỉ báo cho nhân viên ở hai mốc họ thật sự quan tâm: lương được duyệt và
    // lương đã trả. Các bước nội bộ (SUBMIT, RETURN_TO_DRAFT) không cần làm phiền.
    //
    // Bọc try/catch: notify() tự nuốt lỗi của nó, nhưng truy vấn Payslip.find
    // bên dưới thì không. Kỳ lương đã được chốt và commit ở trên rồi — không thể
    // để việc gửi thông báo thất bại kéo theo cả thao tác chốt lương.
    if (action === "APPROVE" || action === "MARK_PAID") {
      try {
        const payslips = await Payslip.find({
          tenantId,
          payrollPeriodId: periodId,
        })
          .select("_id userId")
          .lean();

        const paid = action === "MARK_PAID";

        for (const payslip of payslips) {
          await NotificationService.notify({
            tenantId,
            recipientIds: [payslip.userId],
            type: paid ? "PAYSLIP_PAID" : "PAYSLIP_APPROVED",
            title: paid
              ? "Lương đã được thanh toán"
              : "Phiếu lương đã được duyệt",
            description: paid
              ? "Lương kỳ này đã được chi trả. Xem chi tiết phiếu lương của bạn."
              : "Phiếu lương kỳ này đã được duyệt.",
            link: `/payroll/${payslip._id}`,
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
