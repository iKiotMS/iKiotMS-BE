const GeneratePreviewPayrollDTO = require("../dto/GeneratePreviewPayrollDTO");
const PayrollSettingService = require("./PayrollSettingService");

class PayrollService {
  //===============================================================================
  //==================== Helper Functions ===========================================
  //===============================================================================

  keyById = (items) => {
    return items.reducec((result, item) => {
      result[item._id] = item;
      return result;
    });
  };

  groupByUserId = (items) => {
    return items.reduce((result, item) => {
      const userId = item.userId.toString();
      if (!result[userId]) {
        result[userId] = [];
      }

      result[userId].push(item);
      return result;
    });
  };

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
      .select("_id profile email role branchId warehouseId paySheetId")
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

    const paySheetMap = keyById(paySheets);
    const attendancesByUser = groupByUserId(attendances);
    const schedulesByUser = groupByUserId(workingSchedules);
    const leaveRequestsByUser = groupByUserId(leaveRequests);

    const formattedData = users.map((user) => {
      const userId = user._id.toString();
      const paySheetId = user.paySheetId.toString();

      return {
        user,
        paySheet: paySheetMap[paySheetId] || null,
        attendances: attendancesByUser[userId] || [],
        workingSchedules: schedulesByUser[userId] || [],
        leaveRequests: leaveRequestsByUser[userId] || [],
      };
    });
  }

  caculatePayslipPreview(){
    
  }

  //===============================================================================
  //==================== Main Services ===========================================
  //===============================================================================

  async generatePayRoll({ tenantId, currentUserId, payrollData }) {
    const payrollSetting = PayrollSettingService.getPayrollSetting(tenantId);

    const inputData = new GeneratePreviewPayrollDTO(tenantId, payrollData);
    const employeePayrollInfo = await gatherEmployeePayrollInfo(
      tenantId,
      payrollData.userIds,
      payrollData.periodStart,
      payrollData.periodEnd,
    );

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
    }
  }
}

module.exports = PayrollService;
