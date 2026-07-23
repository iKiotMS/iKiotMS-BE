const PayrollPeriod = require("../../../models/PayrollPeriod");

async function assertAttendanceCanChange(tenantId, workDate) {
  if (!workDate) return null;
  const period = await PayrollPeriod.findOne({
    tenantId,
    periodStart: { $lte: workDate },
    periodEnd: { $gte: workDate },
    status: { $in: ["DRAFT", "REVIEW", "APPROVED", "PAID"] },
  });
  if (!period) return null;

  if (["REVIEW", "APPROVED", "PAID"].includes(period.status)) {
    const error = new Error(
      `Không thể sửa chấm công vì kỳ lương đang ở trạng thái ${period.status}`,
    );
    error.statusCode = 409;
    error.payrollPeriodId = period._id;
    throw error;
  }
  return period.status === "DRAFT" ? period : null;
}

module.exports = { assertAttendanceCanChange };
