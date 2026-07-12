const Holiday = require("../../../models/Holiday");

const DEFAULT_VN_HOLIDAY_CALENDAR_ID =
  process.env.GOOGLE_VN_HOLIDAY_CALENDAR_ID ||
  "vi.vietnamese#holiday@group.v.calendar.google.com";

class HolidaySyncService {
  getYearRange(year) {
    return {
      timeMin: `${year}-01-01T00:00:00.000Z`,
      timeMax: `${year + 1}-01-01T00:00:00.000Z`,
    };
  }

  normalizeGoogleEventDate(event) {
    const dateText = event.start?.date || event.start?.dateTime?.slice(0, 10);

    if (!dateText) {
      return null;
    }
    return new Date(`${dateText}T00:00:00.000Z`);
  }

  async fetchVietnamHolidaysFromGoogle(year) {
    const googleCalendarApiKey = process.env.GOOGLE_CALENDAR_API_KEY;

    if (!googleCalendarApiKey) {
      throw new Error("Missing GOOGLE_CALENDAR_API_KEY");
    }

    const { timeMin, timeMax } = this.getYearRange(year);
    const calendarId = encodeURIComponent(DEFAULT_VN_HOLIDAY_CALENDAR_ID);

    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
    );

    url.searchParams.set("key", googleCalendarApiKey);
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "2500");

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(
        `Google Calendar sync failed: ${response.status} ${errorText}`,
      );
      error.statusCode = 400;
      throw error;
    }

    const data = await response.json();

    return (data.items || [])
      .map((event) => ({
        date: this.normalizeGoogleEventDate(event),
        name: event.summary,
      }))
      .filter((holiday) => holiday.date && holiday.name);
  }

  async syncVietnamPublicHolidays({ tenantId, year }) {
    const holidays = await this.fetchVietnamHolidaysFromGoogle(year);

    if (!holidays.length) {
      return {
        message: "Không có ngày lễ để sync",
        data: [],
      };
    }

    const existingHolidays = await Holiday.find({
      tenantId,
      date: { $in: holidays.map((holiday) => holiday.date) },
      branchId: null,
      type: "PUBLIC_HOLIDAY",
    }).lean();
    const existingByDate = existingHolidays.reduce((result, holiday) => {
      result[new Date(holiday.date).toISOString().slice(0, 10)] = holiday;
      return result;
    }, {});
    let skippedManualCount = 0;
    const operations = holidays.reduce((result, holiday) => {
      const dateKey = holiday.date.toISOString().slice(0, 10);
      const existing = existingByDate[dateKey];

      // Tenant edits always win over the external calendar, including isActive=false.
      if (existing?.isManuallyEdited) {
        skippedManualCount += 1;
        return result;
      }

      result.push({
        updateOne: {
          filter: existing
            ? { _id: existing._id, tenantId }
            : {
                tenantId,
                date: holiday.date,
                branchId: null,
                type: "PUBLIC_HOLIDAY",
              },
          update: {
            $set: {
              name: holiday.name,
              isActive: true,
              source: "GOOGLE_CALENDAR",
              isManuallyEdited: false,
            },
            $setOnInsert: {
              type: "PUBLIC_HOLIDAY",
              branchId: null,
            },
          },
          upsert: !existing,
        },
      });
      return result;
    }, []);

    if (operations.length) await Holiday.bulkWrite(operations);

    return {
      message: "Sync ngày lễ thành công",
      data: holidays,
      syncedCount: operations.length,
      skippedManualCount,
    };
  }
}

module.exports = new HolidaySyncService();
