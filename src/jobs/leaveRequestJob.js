const cron = require("node-cron");
const { LeaveRequest } = require("../models");
const NotificationService = require("../services/notificationService");

const expireOverduePendingRequest = async () => {
  const now = new Date();

  // Lấy danh sách TRƯỚC khi cập nhật — sau updateMany thì không còn biết
  // đơn nào vừa bị đổi trạng thái để mà gửi thông báo.
  const overdue = await LeaveRequest.find({
    status: "PENDING",
    startDate: { $lt: now },
  })
    .select("_id userId tenantId")
    .lean();

  if (overdue.length === 0) return;

  const result = await LeaveRequest.updateMany(
    { _id: { $in: overdue.map((request) => request._id) } },
    { $set: { status: "EXPIRED" } },
  );

  console.log(`[LeaveRequestJob] Expired ${result.modifiedCount} requests`);

  for (const request of overdue) {
    await NotificationService.notify({
      tenantId: request.tenantId,
      recipientIds: [request.userId],
      type: "LEAVE_REQUEST_EXPIRED",
      title: "Đơn nghỉ phép đã hết hạn",
      description:
        "Đơn nghỉ phép của bạn đã quá ngày bắt đầu mà chưa được duyệt nên đã hết hiệu lực.",
      link: `/staffs/schedule/leave-requests/${request._id}`,
      referenceId: request._id,
    });
  }
};

const startLeaveRequestJob = () => {
  // Chạy hằng ngày lúc 00:01 (giờ Việt Nam).
  // Biểu thức cũ "0 1 0 1 * *" có 6 trường nên trường thứ 4 là NGÀY TRONG THÁNG
  // => job chỉ chạy mùng 1 hằng tháng, trái với ý định ghi trong comment.
  cron.schedule("1 0 * * *", expireOverduePendingRequest, {
    timezone: "Asia/Ho_Chi_Minh",
  });
};

module.exports = {
  startLeaveRequestJob,
  expireOverduePendingRequest,
};
