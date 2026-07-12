const NotificationService = require("../service/NotificationService");
const DeviceTokenDTO = require("../dto/DeviceTokenDTO");

const handleError = (error, response) => {
  if (
    error.message === "User not found" ||
    error.message === "Notification not found"
  ) {
    return response.status(404).json({ success: false, message: error.message });
  }
  if (error.message.includes("required")) {
    return response.status(400).json({ success: false, message: error.message });
  }
  console.error("[NotificationController]", error);
  return response
    .status(500)
    .json({ success: false, message: "Internal server error" });
};

class NotificationController {
  async getInbox(request, response) {
    try {
      const page = Math.max(1, parseInt(request.query.page, 10) || 1);
      const limit = Math.min(100, parseInt(request.query.limit, 10) || 20);

      const result = await NotificationService.getInbox(request.user, {
        page,
        limit,
      });

      return response.json({
        success: true,
        message: "Lấy danh sách thông báo thành công",
        data: result.data,
        unreadCount: result.unreadCount,
        pagination: result.pagination,
      });
    } catch (error) {
      return handleError(error, response);
    }
  }

  async getUnreadCount(request, response) {
    try {
      const data = await NotificationService.getUnreadCount(request.user);
      return response.json({ success: true, data });
    } catch (error) {
      return handleError(error, response);
    }
  }

  async markAsRead(request, response) {
    try {
      const data = await NotificationService.markAsRead(
        request.user,
        request.params.id,
      );

      return response.json({
        success: true,
        message: "Đã đánh dấu đã đọc",
        data,
      });
    } catch (error) {
      return handleError(error, response);
    }
  }

  async markAllAsRead(request, response) {
    try {
      const data = await NotificationService.markAllAsRead(request.user);

      return response.json({
        success: true,
        message: "Đã đánh dấu tất cả là đã đọc",
        data,
      });
    } catch (error) {
      return handleError(error, response);
    }
  }

  async registerDeviceToken(request, response) {
    try {
      const dto = new DeviceTokenDTO(request.body);
      dto.validate();

      const data = await NotificationService.registerDeviceToken(
        request.user.userId,
        { token: dto.token, userAgent: dto.userAgent || request.headers["user-agent"] },
      );

      return response.json({
        success: true,
        message: "Đăng ký thiết bị nhận thông báo thành công",
        data,
      });
    } catch (error) {
      return handleError(error, response);
    }
  }

  async removeDeviceToken(request, response) {
    try {
      const dto = new DeviceTokenDTO(request.body);
      dto.validate();

      const data = await NotificationService.removeDeviceToken(
        request.user.userId,
        dto.token,
      );

      return response.json({
        success: true,
        message: "Đã gỡ thiết bị khỏi danh sách nhận thông báo",
        data,
      });
    } catch (error) {
      return handleError(error, response);
    }
  }

  async sendTest(request, response) {
    try {
      if (process.env.NODE_ENV === "production") {
        return response
          .status(404)
          .json({ success: false, message: "Not found" });
      }

      const data = await NotificationService.sendTestToSelf(request.user.userId);

      return response.json({
        success: true,
        message: `Đã gửi tới ${data.sent} thiết bị (${data.failed} thất bại)`,
        data,
      });
    } catch (error) {
      return handleError(error, response);
    }
  }
}

module.exports = new NotificationController();
