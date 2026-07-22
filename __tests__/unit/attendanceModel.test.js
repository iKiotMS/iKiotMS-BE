const Attendance = require("../../src/models/Attendance");

describe("Attendance model", () => {
  test("requires a working schedule and prevents duplicate attendance per user and schedule", () => {
    expect(Attendance.schema.path("scheduleId").isRequired).toBe(true);

    const uniqueIndex = Attendance.schema.indexes().find(([fields, options]) => {
      return fields.userId === 1 && fields.scheduleId === 1 && options.unique;
    });

    expect(uniqueIndex).toBeDefined();
  });
});
