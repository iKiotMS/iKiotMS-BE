const { CheckinDTO } = require("../../src/modules/attendances/dto/CheckinDTO");
const {
  TakeAttendanceService,
} = require("../../src/modules/attendances/service/TakeAttendanceService");

describe("Attendance UTC handling", () => {
  test("check-in DTO rejects invalid check-in time", () => {
    const dto = new CheckinDTO("tenant1", "staff1", {
      scheduleId: "schedule1",
      actualCheckinAt: "not-a-date",
      latitude: 10,
      longitude: 106,
      accuracy: 20,
    });

    expect(dto.validate()).toMatchObject({
      isValid: false,
      statusCode: 400,
      errors: expect.arrayContaining(["Thời gian check-in không hợp lệ"]),
    });
  });

  test("checkDate compares check-in against schedule UTC startAt and endAt", () => {
    const service = new TakeAttendanceService();
    const schedule = {
      startAt: new Date("2026-07-02T01:00:00.000Z"),
      endAt: new Date("2026-07-02T05:00:00.000Z"),
    };

    expect(() => {
      service.checkDate(new Date("2026-07-02T02:00:00.000Z"), schedule);
    }).not.toThrow();

    expect(() => {
      service.checkDate(new Date("2026-07-02T00:59:00.000Z"), schedule);
    }).toThrow("Nhân viên chỉ được check-in trong khoảng thời gian của ca làm");
  });
});
