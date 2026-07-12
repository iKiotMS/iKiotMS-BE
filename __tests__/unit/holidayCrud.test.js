const mongoose = require("mongoose");
const Holiday = require("../../src/models/Holiday");
const HolidayService = require("../../src/modules/holiday/service/HolidayService");
const HolidaySyncService = require("../../src/modules/holiday/service/HolidaySyncService");

describe("Tenant holiday management", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("creates a manual holiday marked as manually edited", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    jest.spyOn(Holiday, "create").mockImplementation(async (data) => data);

    const result = await HolidayService.create({
      tenantId,
      data: { date: "2026-09-03", name: "Nghỉ bổ sung" },
    });

    expect(result).toMatchObject({
      tenantId,
      name: "Nghỉ bổ sung",
      isActive: true,
      source: "MANUAL",
      isManuallyEdited: true,
    });
  });

  test("updates and hard deletes only within the authenticated tenant", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const holidayId = new mongoose.Types.ObjectId();
    jest.spyOn(Holiday, "findOneAndUpdate").mockResolvedValue({
      _id: holidayId,
      isActive: false,
      isManuallyEdited: true,
    });
    jest.spyOn(Holiday, "findOneAndDelete").mockResolvedValue({
      _id: holidayId,
    });

    await HolidayService.updateStatus({
      tenantId,
      holidayId,
      data: { isActive: false },
    });
    expect(Holiday.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: holidayId, tenantId },
      { $set: { isActive: false, isManuallyEdited: true } },
      { new: true, runValidators: true },
    );

    await HolidayService.hardDelete({ tenantId, holidayId });
    expect(Holiday.findOneAndDelete).toHaveBeenCalledWith({
      _id: holidayId,
      tenantId,
    });
  });

  test("requires the dedicated status API for enabling or disabling", async () => {
    await expect(
      HolidayService.update({
        tenantId: new mongoose.Types.ObjectId(),
        holidayId: new mongoose.Types.ObjectId(),
        data: { isActive: false },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      errors: {
        isActive: "Hãy dùng API /status để bật hoặc tắt ngày lễ",
      },
    });
  });

  test("Google sync does not overwrite a manually edited disabled holiday", async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const date = new Date("2026-09-02T00:00:00.000Z");
    jest
      .spyOn(HolidaySyncService, "fetchVietnamHolidaysFromGoogle")
      .mockResolvedValue([{ date, name: "Tên từ Google" }]);
    jest.spyOn(Holiday, "find").mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          date,
          name: "Tên tenant đã sửa",
          isActive: false,
          isManuallyEdited: true,
        },
      ]),
    });
    jest.spyOn(Holiday, "bulkWrite").mockResolvedValue({});

    const result = await HolidaySyncService.syncVietnamPublicHolidays({
      tenantId,
      year: 2026,
    });

    expect(result.skippedManualCount).toBe(1);
    expect(Holiday.bulkWrite).not.toHaveBeenCalled();
  });
});
