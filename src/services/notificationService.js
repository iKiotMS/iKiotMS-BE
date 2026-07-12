const { Notification, User } = require("../models");
const { emitToRoom } = require("./socketService");
const { sendToUsers } = require("./pushService");
const { attachUserName, USER_NAME_SELECT } = require("../utils/userName");

const STAFF_ROLES = ["TENANT_OWNER", "BRANCH_MANAGER", "WAREHOUSE_MANAGER", "STAFF"];

const toIdString = (value) => (value ? String(value) : null);

const uniqueIds = (ids) =>
  [...new Set((ids || []).map(toIdString).filter(Boolean))];

/* ------------------------------------------------------------------ *
 * Người nhận
 * ------------------------------------------------------------------ */

/**
 * Bọc một hàm tra cứu để nó KHÔNG BAO GIỜ ném lỗi ra ngoài.
 *
 * Đây là bất biến của cả module: mọi thứ liên quan tới thông báo đều là kênh
 * phụ. Các hàm tra cứu bên dưới đều chạm DB, và chúng được gọi từ trong luồng
 * duyệt phép / nhận hàng / chốt lương — nếu một truy vấn hỏng mà ném lên, nó sẽ
 * làm hỏng cả nghiệp vụ vốn đã commit xong. Thà không gửi được thông báo.
 */
const safely = (label, fallback, fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    console.error(`[notificationService] ${label} thất bại:`, error.message);
    return fallback;
  }
};

/**
 * Tên hiển thị của một người dùng, để ghép vào nội dung thông báo
 * ("Nguyễn Văn A đã gửi đơn nghỉ phép"). Rơi về email/SĐT khi chưa có hồ sơ.
 */
const displayName = safely("displayName", "Nhân viên", async (userId) => {
  if (!userId) return "Nhân viên";

  const user = await User.findById(userId).select(USER_NAME_SELECT).lean();
  if (!user) return "Nhân viên";

  attachUserName(user);
  return user.name || user.email || user.phoneNumber || "Nhân viên";
});

/** Chủ cửa hàng của một tenant. */
const tenantOwners = safely("tenantOwners", [], async (tenantId) => {
  const owners = await User.find({
    tenantId,
    role: "TENANT_OWNER",
    status: "ACTIVE",
  })
    .select("_id")
    .lean();

  return owners.map((owner) => owner._id);
});

/**
 * Quản lý phụ trách một địa điểm cụ thể.
 * Kho  -> WAREHOUSE_MANAGER có warehouseId khớp.
 * Chi nhánh -> BRANCH_MANAGER có branchId khớp.
 */
const managersOfLocation = safely(
  "managersOfLocation",
  [],
  async ({ tenantId, locationId, locationType }) => {
    if (!locationId || !locationType) return [];

    const query =
      locationType === "warehouse"
        ? { role: "WAREHOUSE_MANAGER", warehouseId: locationId }
        : { role: "BRANCH_MANAGER", branchId: locationId };

    const managers = await User.find({ tenantId, status: "ACTIVE", ...query })
      .select("_id")
      .lean();

    return managers.map((manager) => manager._id);
  },
);

/**
 * Người duyệt của một nhân viên.
 *
 * Nhân viên chi nhánh -> quản lý chi nhánh đó. Nếu chi nhánh chưa có quản lý
 * (hoặc chính người này LÀ quản lý chi nhánh), đẩy lên chủ cửa hàng.
 *
 * Kho không có nhân viên cấp dưới nên WAREHOUSE_MANAGER luôn báo lên chủ —
 * permissions.json cũng không cho họ quyền approve/reject nghỉ phép.
 */
const approversOf = safely("approversOf", [], async (user) => {
  if (!user) return [];

  if (user.role === "STAFF" && user.branchId) {
    const managers = await managersOfLocation({
      tenantId: user.tenantId,
      locationId: user.branchId,
      locationType: "branch",
    });

    // Loại chính mình ra, phòng trường hợp dữ liệu lệch.
    const others = managers.filter(
      (id) => toIdString(id) !== toIdString(user._id || user.userId),
    );

    if (others.length > 0) return others;
  }

  return tenantOwners(user.tenantId);
});

/* ------------------------------------------------------------------ *
 * Fan-out
 * ------------------------------------------------------------------ */

/**
 * Gửi thông báo tới một nhóm người nhận, qua cả ba kênh:
 *
 *   1. Lưu Notification vào MongoDB  -> nguồn sự thật, dựng được hộp thư + badge
 *   2. Socket.io tới room user:<id>  -> user đang mở app: UI cập nhật tức thì
 *   3. FCM push                      -> user đã rời app
 *
 * KHÔNG BAO GIỜ throw. Thông báo là kênh phụ: nếu Mongo/FCM lỗi thì nghiệp vụ
 * đã gọi nó (duyệt phép, nhận hàng, thanh toán...) vẫn phải thành công. Mọi lỗi
 * chỉ được log.
 */
const notify = async ({
  tenantId,
  recipientIds,
  type,
  title,
  description,
  link,
  referenceId,
}) => {
  try {
    const ids = uniqueIds(recipientIds);
    if (ids.length === 0) return { notified: 0 };

    const docs = await Notification.insertMany(
      ids.map((recipientId) => ({
        tenantId,
        recipientId,
        type,
        title,
        description,
        link,
        referenceId: toIdString(referenceId),
        isRead: false,
      })),
    );

    for (const doc of docs) {
      emitToRoom(`user:${doc.recipientId}`, "notification", doc);
    }

    await sendToUsers(ids, {
      title,
      body: description,
      link,
      data: { type, referenceId: toIdString(referenceId) || "" },
    });

    return { notified: ids.length };
  } catch (error) {
    console.error(`[notificationService] Failed to notify (${type}):`, error.message);
    return { notified: 0 };
  }
};

module.exports = {
  notify,
  displayName,
  tenantOwners,
  managersOfLocation,
  approversOf,
  STAFF_ROLES,
};
