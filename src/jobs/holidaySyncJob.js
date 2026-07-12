const cron = require("node-cron");
const { Tenant } = require("../models");
const HolidaySyncService = require("../modules/holiday/service/HolidaySyncService");

function getSyncYears() {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear + 1];
}

async function syncVietnamHolidaysForAllTenants() {
  if (!process.env.GOOGLE_CALENDAR_API_KEY) {
    console.log("[HolidaySyncJob] Skipped: GOOGLE_CALENDAR_API_KEY is missing");
    return;
  }

  const tenants = await Tenant.find({ status: "ACTIVE" }).select("_id").lean();
  const years = getSyncYears();

  for (const tenant of tenants) {
    for (const year of years) {
      try {
        const result = await HolidaySyncService.syncVietnamPublicHolidays({
          tenantId: tenant._id,
          year,
        });

        console.log(
          `[HolidaySyncJob] Synced ${result.data.length} holidays for tenant ${tenant._id} in ${year}`,
        );
      } catch (error) {
        console.error(
          `[HolidaySyncJob] Failed for tenant ${tenant._id}:`,
          error.message,
        );
      }
    }
  }
}

function startHolidaySyncJob() {
  // Chạy 02:30 sáng ngày đầu mỗi tháng để kịp cập nhật thay đổi từ Google Calendar.
  cron.schedule("30 2 1 * *", syncVietnamHolidaysForAllTenants);
  console.log("[HolidaySyncJob] Scheduled monthly on day 1 at 02:30 AM");
}

module.exports = {
  startHolidaySyncJob,
  syncVietnamHolidaysForAllTenants,
};
