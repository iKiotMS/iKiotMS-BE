require("dotenv").config({ path: ".env", override: true });

const shouldRunGoogleCalendarTest =
  process.env.RUN_GOOGLE_CALENDAR_TEST === "true";

const describeGoogleCalendar = shouldRunGoogleCalendarTest
  ? describe
  : describe.skip;

describeGoogleCalendar("Google Calendar holiday sync", () => {
  test("fetches Vietnam public holidays from Google Calendar", async () => {
    const HolidaySyncService = require("../../src/modules/holiday/service/HolidaySyncService");
    const year =
      Number(process.env.GOOGLE_CALENDAR_TEST_YEAR) ||
      new Date().getFullYear();

    const holidays =
      await HolidaySyncService.fetchVietnamHolidaysFromGoogle(year);

    expect(Array.isArray(holidays)).toBe(true);
    expect(holidays.length).toBeGreaterThan(0);

    holidays.forEach((holiday) => {
      expect(holiday.name).toEqual(expect.any(String));
      expect(holiday.name.length).toBeGreaterThan(0);
      expect(holiday.date).toBeInstanceOf(Date);
      expect(Number.isNaN(holiday.date.getTime())).toBe(false);
    });

    console.log(
      `[GoogleCalendarHolidayTest] ${year}: fetched ${holidays.length} holidays`,
    );
    console.log(
      holidays.map((holiday) => {
        return `${holiday.date.toISOString().slice(0, 10)} - ${holiday.name}`;
      }),
    );
  }, 30000);
});
