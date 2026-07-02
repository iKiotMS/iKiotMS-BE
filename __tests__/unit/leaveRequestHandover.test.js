jest.mock("../../src/models/LeaveRequest", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock("../../src/models", () => ({
  User: {
    findOne: jest.fn(),
  },
  WorkingSchedule: {
    find: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const mongoose = require("mongoose");
const LeaveRequest = require("../../src/models/LeaveRequest");
const { User, WorkingSchedule } = require("../../src/models");
const LeaveRequestService = require("../../src/modules/leaveRequest/service/LeaveRequestService");

const makeQuery = (value) => {
  const query = {
    select: jest.fn(() => query),
    session: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(value),
  };

  return query;
};

describe("LeaveRequestService manager schedule handover", () => {
  const tenantId = "64a000000000000000000001";
  const managerId = "64a000000000000000000002";
  const handoverToUserId = "64a000000000000000000003";
  const branchId = "64a000000000000000000004";

  let session;

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);

    User.findOne.mockReturnValue(
      makeQuery({
        _id: handoverToUserId,
        role: "STAFF",
        branchId,
      }),
    );

    WorkingSchedule.updateMany.mockResolvedValue({ modifiedCount: 2 });

    LeaveRequest.create.mockImplementation(async (docs) => [
      {
        _id: "64a000000000000000000099",
        ...docs[0],
      },
    ]);
    LeaveRequest.findOne.mockReset();
    LeaveRequest.findOneAndUpdate.mockReset();
  });

  afterEach(() => {
    mongoose.startSession.mockRestore();
    jest.useRealTimers();
  });

  test("creates manager leave request and reassigns affected schedules", async () => {
    WorkingSchedule.find.mockReturnValue(
      makeQuery([
        { _id: "64a000000000000000000011" },
        { _id: "64a000000000000000000012" },
      ]),
    );

    const result = await LeaveRequestService.createLeaveRequest({
      tenantId,
      userId: managerId,
      user: {
        userId: managerId,
        role: "BRANCH_MANAGER",
        branchId,
      },
      leaveRequestData: {
        leaveType: "ANNUAL",
        startDate: "2099-07-04T00:00:00.000Z",
        endDate: "2099-07-05T00:00:00.000Z",
        reason: "Family trip",
        handoverToUserId,
      },
    });

    expect(result.handover).toEqual({
      required: true,
      reassignedSchedules: 2,
      handoverToUserId,
    });
    expect(LeaveRequest.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          tenantId,
          userId: managerId,
          handoverToUserId,
        }),
      ],
      { session },
    );
    expect(WorkingSchedule.updateMany).toHaveBeenCalledWith(
      {
        _id: {
          $in: ["64a000000000000000000011", "64a000000000000000000012"],
        },
        tenantId,
        managedBy: managerId,
      },
      {
        $set: {
          managedBy: handoverToUserId,
        },
      },
      { session },
    );
  });

  test("requires handoverToUserId when manager has schedules during leave", async () => {
    WorkingSchedule.find.mockReturnValue(
      makeQuery([{ _id: "64a000000000000000000011" }]),
    );

    await expect(
      LeaveRequestService.createLeaveRequest({
        tenantId,
        userId: managerId,
        user: {
          userId: managerId,
          role: "BRANCH_MANAGER",
          branchId,
        },
        leaveRequestData: {
          leaveType: "ANNUAL",
          startDate: "2099-07-04T00:00:00.000Z",
          endDate: "2099-07-05T00:00:00.000Z",
          reason: "Family trip",
        },
      }),
    ).rejects.toThrow("handoverToUserId is required");

    expect(LeaveRequest.create).not.toHaveBeenCalled();
    expect(WorkingSchedule.updateMany).not.toHaveBeenCalled();
  });

  test("cancels pending leave request using UTC day boundary", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2099-07-03T23:30:00.000Z"));

    LeaveRequest.findOne
      .mockResolvedValueOnce({
        _id: "64a000000000000000000099",
        tenantId,
        userId: managerId,
        status: "PENDING",
        startDate: new Date("2099-07-04T00:00:00.000Z"),
        endDate: new Date("2099-07-05T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        _id: "64a000000000000000000099",
        tenantId,
        userId: managerId,
        status: "PENDING",
        startDate: new Date("2099-07-04T00:00:00.000Z"),
        endDate: new Date("2099-07-05T00:00:00.000Z"),
      });
    LeaveRequest.findOneAndUpdate.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: "64a000000000000000000099",
        status: "CANCELLED",
      }),
    });

    const result = await LeaveRequestService.cancelLeaveRequest({
      tenantId,
      leaveRequestId: "64a000000000000000000099",
      userId: managerId,
    });

    expect(result).toEqual({
      _id: "64a000000000000000000099",
      status: "CANCELLED",
    });
    expect(LeaveRequest.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "64a000000000000000000099", tenantId },
      { $set: { status: "CANCELLED" } },
      { new: true, runValidators: true },
    );
  });
});
