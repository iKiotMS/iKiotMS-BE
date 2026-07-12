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

  test("checkDate allows check-in up to 30 minutes before schedule start", () => {
    const service = new TakeAttendanceService();
    const schedule = {
      startAt: new Date("2026-07-02T01:00:00.000Z"),
      endAt: new Date("2026-07-02T05:00:00.000Z"),
    };

    expect(() => {
      service.checkDate(new Date("2026-07-02T00:30:00.000Z"), schedule);
    }).not.toThrow();

    expect(() => {
      service.checkDate(new Date("2026-07-02T02:00:00.000Z"), schedule);
    }).not.toThrow();

    expect(() => {
      service.checkDate(new Date("2026-07-02T00:29:00.000Z"), schedule);
    }).toThrow(
      "Nhân viên chỉ được check-in trong khoảng thời gian của ca làm và trước ca làm 30 phút",
    );
  });
});
