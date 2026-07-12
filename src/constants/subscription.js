// Hằng số dùng chung cho subscription (job, middleware, service)

const GRACE_PERIOD_DAYS = 3; // số ngày gia hạn thêm sau khi hết hạn trước khi khoá
const REMINDER_DAYS = [7, 3, 1]; // gửi email nhắc trước khi hết hạn (ngày)
const BILLING_DAYS = { MONTHLY: 30, YEARLY: 365 };
const QR_EXPIRY_MS = 15 * 60 * 1000; // QR thanh toán hợp lệ 15 phút

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function getBillingDays(billingCycle) {
  return BILLING_DAYS[billingCycle] ?? BILLING_DAYS.MONTHLY;
}

module.exports = {
  GRACE_PERIOD_DAYS,
  REMINDER_DAYS,
  BILLING_DAYS,
  QR_EXPIRY_MS,
  DAY_MS,
  addDays,
  getBillingDays,
};
