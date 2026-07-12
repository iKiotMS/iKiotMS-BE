const cron = require("node-cron");
const { Subscription } = require("../models");
const { sendSubscriptionReminder } = require("../services/emailService");
const NotificationService = require("../services/notificationService");
const {
  GRACE_PERIOD_DAYS,
  REMINDER_DAYS,
  DAY_MS,
  addDays,
} = require("../constants/subscription");

function startOfTodayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Báo cho chủ cửa hàng của các subscription vừa đổi trạng thái.
 * Phải lấy danh sách TRƯỚC updateMany — sau đó thì không còn biết cái nào vừa đổi.
 */
async function notifyStatusChange(subscriptions, { type, title, description }) {
  for (const sub of subscriptions) {
    const owners = await NotificationService.tenantOwners(sub.tenantId);

    await NotificationService.notify({
      tenantId: sub.tenantId,
      recipientIds: owners,
      type,
      title,
      description,
      link: "/pricing",
      referenceId: sub._id,
    });
  }
}

async function runSubscriptionStatusCheck() {
  const now = new Date();
  const graceCutoff = addDays(now, -GRACE_PERIOD_DAYS);

  // Chụp lại danh sách trước khi cập nhật, để biết ai vừa bị đổi trạng thái.
  const [trialsToExpire, toExpire] = await Promise.all([
    Subscription.find({ status: "TRIAL", trialEndDate: { $lt: now } })
      .select("_id tenantId")
      .lean(),
    Subscription.find({ status: "PAST_DUE", endDate: { $lt: graceCutoff } })
      .select("_id tenantId")
      .lean(),
  ]);

  // TRIAL đã hết ngày trial → EXPIRED
  const expiredTrials = await Subscription.updateMany(
    { status: "TRIAL", trialEndDate: { $lt: now } },
    { $set: { status: "EXPIRED" } },
  );

  // ACTIVE đã qua endDate → PAST_DUE (bắt đầu grace period)
  const markedPastDue = await Subscription.updateMany(
    { status: "ACTIVE", endDate: { $lt: now } },
    { $set: { status: "PAST_DUE" } },
  );

  // PAST_DUE đã qua grace period → EXPIRED
  const markedExpired = await Subscription.updateMany(
    { status: "PAST_DUE", endDate: { $lt: graceCutoff } },
    { $set: { status: "EXPIRED" } },
  );

  console.log(
    `[SubscriptionJob] Trial expired: ${expiredTrials.modifiedCount} | ` +
      `Past due: ${markedPastDue.modifiedCount} | ` +
      `Expired: ${markedExpired.modifiedCount}`,
  );

  await notifyStatusChange(trialsToExpire, {
    type: "SUBSCRIPTION_EXPIRED",
    title: "Bản dùng thử đã kết thúc",
    description: "Thời gian dùng thử đã hết. Nâng cấp gói để tiếp tục sử dụng.",
  });

  await notifyStatusChange(toExpire, {
    type: "SUBSCRIPTION_EXPIRED",
    title: "Gói dịch vụ đã hết hạn",
    description: "Gói dịch vụ đã hết hạn và hết thời gian gia hạn. Vui lòng thanh toán để khôi phục.",
  });
}

async function sendExpiryReminders() {
  const today = startOfTodayUTC();

  for (const days of REMINDER_DAYS) {
    const windowStart = addDays(today, days);
    const windowEnd = new Date(windowStart.getTime() + DAY_MS);

    const subscriptions = await Subscription.find({
      status: { $in: ["TRIAL", "ACTIVE"] },
      endDate: { $gte: windowStart, $lt: windowEnd },
    })
      .populate({
        path: "tenantId",
        populate: { path: "tenantOwnerId", select: "email profile" },
      })
      .populate("planId", "planName")
      .lean();

    for (const sub of subscriptions) {
      const owner = sub.tenantId?.tenantOwnerId;

      // Push + lưu vào hộp thư, song song với email. Chủ cửa hàng thường không
      // mở dashboard mỗi ngày nên đây đúng là ca dùng push.
      await NotificationService.notify({
        tenantId: sub.tenantId?._id,
        recipientIds: [owner?._id],
        type: "SUBSCRIPTION_EXPIRING",
        title: "Gói dịch vụ sắp hết hạn",
        description: `Gói ${sub.planId?.planName || "dịch vụ"} của bạn sẽ hết hạn sau ${days} ngày. Gia hạn để không bị gián đoạn.`,
        link: "/pricing",
        referenceId: sub._id,
      });

      const email = owner?.email;
      if (!email) continue;

      try {
        await sendSubscriptionReminder(email, {
          tenantName: sub.tenantId?.name || "Quý khách",
          planName: sub.planId?.planName || "Gói dịch vụ",
          daysLeft: days,
          endDate: sub.endDate,
        });
        console.log(
          `[SubscriptionJob] Sent ${days}-day reminder → ${email}`,
        );
      } catch (err) {
        console.error(
          `[SubscriptionJob] Failed to send reminder → ${email}:`,
          err.message,
        );
      }
    }
  }
}

async function runDailyJob() {
  console.log("[SubscriptionJob] Running daily subscription check...");
  try {
    await runSubscriptionStatusCheck();
    await sendExpiryReminders();
  } catch (err) {
    console.error("[SubscriptionJob] Unhandled error:", err.message);
  }
}

function startSubscriptionJob() {
  // Chạy mỗi ngày lúc 02:00 SA
  cron.schedule("0 2 * * *", runDailyJob);
  console.log("[SubscriptionJob] Scheduled daily at 02:00 AM");
}

module.exports = { startSubscriptionJob, runSubscriptionStatusCheck };
