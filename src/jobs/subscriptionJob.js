const cron = require("node-cron");
const { Subscription } = require("../models");
const { sendSubscriptionReminder } = require("../services/emailService");
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

async function runSubscriptionStatusCheck() {
  const now = new Date();
  const graceCutoff = addDays(now, -GRACE_PERIOD_DAYS);

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
