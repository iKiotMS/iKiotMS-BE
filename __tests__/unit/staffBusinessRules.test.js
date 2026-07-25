const mockUser = {
  countDocuments: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  startSession: jest.fn(),
};

const mockPaysheet = {
  exists: jest.fn(),
};

const mockLeaveRequest = {
  exists: jest.fn(),
};

const mockRefreshToken = {
  updateMany: jest.fn(),
};

jest.mock("../../src/models", () => ({
  User: mockUser,
  Branch: { findOne: jest.fn() },
  Warehouse: { findOne: jest.fn() },
  RefreshToken: mockRefreshToken,
}));

jest.mock("../../src/models/Paysheet", () => mockPaysheet);
jest.mock("../../src/models/LeaveRequest", () => mockLeaveRequest);

const StaffService = require("../../src/modules/staff/service/StaffService");

const TENANT_ID = "64a000000000000000000001";
const STAFF_ID = "64a000000000000000000002";
const PAY_SHEET_ID = "64a000000000000000000003";

function createSession() {
  return {
    withTransaction: jest.fn(async (callback) => callback()),
    endSession: jest.fn(),
  };
}

function sessionQuery(value) {
  return {
    session: jest.fn().mockResolvedValue(value),
  };
}

describe("StaffService business rules", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test("rejects a missing paysheet when creating staff", async () => {
    jest
      .spyOn(StaffService, "checkRoleAndBranchValidity")
      .mockResolvedValue(undefined);
    jest
      .spyOn(StaffService, "checkStaffUniqueness")
      .mockResolvedValue(undefined);
    const createSpy = jest.spyOn(StaffService, "create");
    mockPaysheet.exists.mockResolvedValue(null);

    await expect(
      StaffService.createStaff({
        tenantId: TENANT_ID,
        userRole: "TENANT_OWNER",
        data: {
          phoneNumber: "0901234567",
          role: "STAFF",
          branchId: "64a000000000000000000004",
          paySheetId: PAY_SHEET_ID,
        },
      }),
    ).rejects.toMatchObject({
      name: "StaffValidationError",
      field: "paySheetId",
      message: "Bảng lương không tồn tại hoặc đã bị xóa",
    });

    expect(mockPaysheet.exists).toHaveBeenCalledWith({
      _id: PAY_SHEET_ID,
      tenantId: TENANT_ID,
      status: "ACTIVE",
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  test("records who created a staff member", async () => {
    const createdBy = "64a000000000000000000005";
    jest
      .spyOn(StaffService, "checkRoleAndBranchValidity")
      .mockResolvedValue(undefined);
    jest
      .spyOn(StaffService, "checkStaffUniqueness")
      .mockResolvedValue(undefined);
    mockUser.findOne.mockResolvedValue(null);
    const createSpy = jest
      .spyOn(StaffService, "create")
      .mockResolvedValue({ _id: STAFF_ID });

    await StaffService.createStaff({
      tenantId: TENANT_ID,
      userRole: "TENANT_OWNER",
      createdBy,
      data: {
        phoneNumber: "0901234567",
        role: "STAFF",
        branchId: "64a000000000000000000004",
      },
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy }),
    );
  });

  test("rejects a missing paysheet when updating staff", async () => {
    mockUser.findOne.mockResolvedValue({
      _id: STAFF_ID,
      tenantId: TENANT_ID,
      role: "STAFF",
      branchId: "64a000000000000000000004",
      warehouseId: null,
      profile: {},
    });
    jest
      .spyOn(StaffService, "checkRoleAndBranchValidity")
      .mockResolvedValue(undefined);
    jest
      .spyOn(StaffService, "checkStaffUniqueness")
      .mockResolvedValue(undefined);
    mockPaysheet.exists.mockResolvedValue(null);

    await expect(
      StaffService.updateStaff({
        tenantId: TENANT_ID,
        userId: "64a000000000000000000005",
        staffId: STAFF_ID,
        userRole: "TENANT_OWNER",
        data: { paySheetId: PAY_SHEET_ID },
      }),
    ).rejects.toMatchObject({
      name: "StaffValidationError",
      field: "paySheetId",
    });

    expect(mockUser.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("creates leave balance when the embedded fields do not exist", async () => {
    jest
      .spyOn(StaffService, "buildStaffAccessFilter")
      .mockResolvedValue({});
    mockUser.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: STAFF_ID,
          role: "STAFF",
        }),
      }),
    });

    const updatedStaff = {
      _id: STAFF_ID,
      leaveBalance: { annualLeaveDays: 15, remainingDays: 15 },
    };
    const updateQuery = {
      select: jest.fn(),
      populate: jest.fn(),
    };
    updateQuery.select.mockReturnValue(updateQuery);
    updateQuery.populate
      .mockReturnValueOnce(updateQuery)
      .mockResolvedValueOnce(updatedStaff);
    mockUser.findOneAndUpdate.mockReturnValue(updateQuery);

    const result = await StaffService.createLeaveBalance({
      tenantId: TENANT_ID,
      requesterId: "64a000000000000000000005",
      requesterRole: "TENANT_OWNER",
      staffId: STAFF_ID,
      data: { annualLeaveDays: 15 },
    });

    expect(mockUser.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        _id: STAFF_ID,
        "leaveBalance.annualLeaveDays": { $exists: false },
        "leaveBalance.remainingDays": { $exists: false },
      }),
      {
        $set: {
          "leaveBalance.annualLeaveDays": 15,
          "leaveBalance.remainingDays": 15,
        },
      },
      { new: true, runValidators: true },
    );
    expect(result.leaveBalance).toEqual({
      annualLeaveDays: 15,
      remainingDays: 15,
      usedDays: 0,
    });
  });

  test("rejects deactivating an already inactive staff account", async () => {
    const session = createSession();
    const staff = {
      _id: STAFF_ID,
      role: "STAFF",
      status: "INACTIVE",
      save: jest.fn(),
    };
    mockUser.startSession.mockResolvedValue(session);
    mockUser.findOne.mockReturnValue(sessionQuery(staff));
    jest.spyOn(StaffService, "checkStaffId").mockResolvedValue(undefined);

    await expect(
      StaffService.deactivateStaffAccount({
        tenantId: TENANT_ID,
        userId: "64a000000000000000000005",
        userRole: "TENANT_OWNER",
        staffId: STAFF_ID,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Tài khoản nhân viên đã bị vô hiệu hóa",
    });

    expect(mockLeaveRequest.exists).not.toHaveBeenCalled();
    expect(staff.save).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  test.each([
    ["deactivateStaffAccount", "vô hiệu hóa"],
    ["deleteStaff", "xóa"],
  ])(
    "rejects %s while staff is an active leave handover target",
    async (methodName) => {
      const session = createSession();
      const staff = {
        _id: STAFF_ID,
        role: "STAFF",
        status: "ACTIVE",
        save: jest.fn(),
      };
      mockUser.startSession.mockResolvedValue(session);
      mockUser.findOne.mockReturnValue(sessionQuery(staff));
      mockLeaveRequest.exists.mockReturnValue(
        sessionQuery({ _id: "64a000000000000000000006" }),
      );
      jest.spyOn(StaffService, "checkStaffId").mockResolvedValue(undefined);

      await expect(
        StaffService[methodName]({
          tenantId: TENANT_ID,
          userId: "64a000000000000000000005",
          userRole: "TENANT_OWNER",
          staffId: STAFF_ID,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message:
          "Không thể vô hiệu hóa hoặc xóa nhân viên đang được chỉ định nhận bàn giao trong đơn nghỉ còn hiệu lực",
      });

      expect(mockLeaveRequest.exists).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        handoverToUserId: STAFF_ID,
        status: { $in: ["PENDING", "APPROVED"] },
        endDate: { $gte: expect.any(Date) },
      });
      expect(staff.save).not.toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
    },
  );

  test("anonymizes PII but preserves role and workplace on soft delete", async () => {
    const session = createSession();
    const deletedBy = "64a000000000000000000005";
    const branchId = "64a000000000000000000004";
    const staff = {
      _id: STAFF_ID,
      tenantId: TENANT_ID,
      phoneNumber: "0901234567",
      email: "staff@example.com",
      password: "hashed-password",
      fcmTokens: [{ token: "device-token" }],
      role: "STAFF",
      branchId,
      warehouseId: null,
      status: "ACTIVE",
      profile: {
        firstName: "An",
        lastName: "Nguyen",
        identificationId: "079201000001",
        taxNumber: "TAX123",
        address: "Ho Chi Minh City",
        avatarUrl: "https://example.com/avatar.png",
      },
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockUser.startSession.mockResolvedValue(session);
    mockUser.findOne.mockReturnValue(sessionQuery(staff));
    mockLeaveRequest.exists.mockReturnValue(sessionQuery(null));
    mockRefreshToken.updateMany.mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(StaffService, "checkStaffId").mockResolvedValue(undefined);
    jest
      .spyOn(StaffService, "getStaffAccountResponse")
      .mockResolvedValue({ _id: STAFF_ID, status: "DELETED" });

    await StaffService.deleteStaff({
      tenantId: TENANT_ID,
      userId: deletedBy,
      userRole: "TENANT_OWNER",
      staffId: STAFF_ID,
      deletionReason: "  Nhân viên nghỉ việc  ",
    });

    expect(staff).toMatchObject({
      tenantId: TENANT_ID,
      phoneNumber: `deleted_${STAFF_ID}`,
      email: null,
      password: undefined,
      fcmTokens: [],
      role: "STAFF",
      branchId,
      warehouseId: null,
      status: "DELETED",
      deletedBy,
      deletionReason: "Nhân viên nghỉ việc",
      profile: {
        firstName: "An",
        lastName: "Nguyen",
        identificationId: null,
        taxNumber: null,
        address: null,
        avatarUrl: null,
      },
    });
    expect(staff.deletedAt).toBeInstanceOf(Date);
    expect(staff.save).toHaveBeenCalledWith({ session });
    expect(mockRefreshToken.updateMany).toHaveBeenCalledWith(
      { userId: STAFF_ID, isRevoked: false },
      { $set: { isRevoked: true } },
      { session },
    );
  });
});
