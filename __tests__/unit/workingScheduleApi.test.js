const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../src/modules/schedule/service/WorkingScheduleService", () => ({
  createBulkWorkingSchedules: jest.fn(),
  getBranchWorkingSchedules: jest.fn(),
  getMyWorkingSchedules: jest.fn(),
  getWarehouseWorkingSchedules: jest.fn(),
  getWorkingScheduleUserDetail: jest.fn(),
}));

jest.mock("../../src/utils/redisTest", () => {
  return jest.requireActual("express").Router();
});

const { createApp } = require("../../src/app");
const WorkingScheduleService = require("../../src/modules/schedule/service/WorkingScheduleService");

describe("Working Schedule API response", () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const generateToken = ({
    userId = "manager1",
    role = "TENANT_OWNER",
  } = {}) => {
    return jwt.sign(
      {
        userId,
        phoneNumber: "0901000001",
        role,
        tenantId: "tenant1",
      },
      process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
  };

  test("POST /working-schedules/bulk returns the success output from the API", async () => {
    WorkingScheduleService.createBulkWorkingSchedules.mockResolvedValue({
      message: "Phân ca thành công",
      data: [
        {
          _id: "schedule1",
          tenantId: "tenant1",
          userId: ["staffA", "staffB"],
          shiftTemplateId: "morningShift",
          workDate: "2026-07-01T00:00:00.000Z",
          startAt: "2026-07-01T01:00:00.000Z",
          endAt: "2026-07-01T05:00:00.000Z",
          status: "SCHEDULED",
        },
      ],
    });

    const response = await request(app)
      .post("/working-schedules/bulk")
      .set("Authorization", `Bearer ${generateToken()}`)
      .send({
        schedules: [
          {
            userId: ["staffA", "staffB"],
            shiftTemplateId: "morningShift",
            workDate: "2026-07-01",
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      message: "Phân ca thành công",
      data: [
        {
          _id: "schedule1",
          tenantId: "tenant1",
          userId: ["staffA", "staffB"],
          shiftTemplateId: "morningShift",
          workDate: "2026-07-01T00:00:00.000Z",
          startAt: "2026-07-01T01:00:00.000Z",
          endAt: "2026-07-01T05:00:00.000Z",
          status: "SCHEDULED",
        },
      ],
    });
    expect(WorkingScheduleService.createBulkWorkingSchedules).toHaveBeenCalledWith(
      "tenant1",
      "manager1",
      {
        schedules: [
          {
            userId: ["staffA", "staffB"],
            shiftTemplateId: "morningShift",
            workDate: "2026-07-01",
          },
        ],
      },
      "TENANT_OWNER",
    );
  });

  test("POST /working-schedules/bulk returns the error output from the API", async () => {
    const error = new Error("Nhân viên đã có lịch làm việc bị trùng thời gian");
    error.statusCode = 400;
    error.duplicatedWorkingSchedule = {
      _id: "schedule1",
      userId: ["staffA"],
    };
    WorkingScheduleService.createBulkWorkingSchedules.mockRejectedValue(error);

    const response = await request(app)
      .post("/working-schedules/bulk")
      .set("Authorization", `Bearer ${generateToken()}`)
      .send({
        schedules: [
          {
            userId: "staffA",
            shiftTemplateId: "overlapShift",
            workDate: "2026-07-01",
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Nhân viên đã có lịch làm việc bị trùng thời gian",
      duplicatedWorkingSchedule: {
        _id: "schedule1",
        userId: ["staffA"],
      },
    });
  });

  test("POST /working-schedules/bulk blocks staff", async () => {
    const response = await request(app)
      .post("/working-schedules/bulk")
      .set(
        "Authorization",
        `Bearer ${generateToken({ userId: "staffA", role: "STAFF" })}`,
      )
      .send({
        schedules: [
          {
            userId: "staffA",
            shiftTemplateId: "morningShift",
            workDate: "2026-07-01",
          },
        ],
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "Forbidden: You don't have permission to create schedules",
    });
    expect(WorkingScheduleService.createBulkWorkingSchedules).not.toHaveBeenCalled();
  });

  test("GET /working-schedules/me returns only the current user's schedules", async () => {
    WorkingScheduleService.getMyWorkingSchedules.mockResolvedValue({
      data: [
        {
          _id: "schedule1",
          userId: [
            {
              _id: "staffA",
              attendance: {
                status: "NOT_CHECKED_IN",
                actualCheckinAt: null,
                actualCheckoutAt: null,
              },
            },
          ],
          status: "SCHEDULED",
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        recordPerPage: 10,
        totalPage: 1,
      },
    });

    const response = await request(app)
      .get("/working-schedules/me")
      .set(
        "Authorization",
        `Bearer ${generateToken({ userId: "staffA", role: "STAFF" })}`,
      );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          _id: "schedule1",
          userId: [
            {
              _id: "staffA",
              attendance: {
                status: "NOT_CHECKED_IN",
                actualCheckinAt: null,
                actualCheckoutAt: null,
              },
            },
          ],
          status: "SCHEDULED",
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        recordPerPage: 10,
        totalPage: 1,
      },
    });
    expect(WorkingScheduleService.getMyWorkingSchedules).toHaveBeenCalledWith(
      "tenant1",
      "staffA",
      {},
    );
  });

  test("GET /working-schedules blocks staff from the tenant-wide list", async () => {
    const response = await request(app)
      .get("/working-schedules")
      .set(
        "Authorization",
        `Bearer ${generateToken({ userId: "staffA", role: "STAFF" })}`,
      );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "Forbidden: You don't have permission to read_all schedules",
    });
  });

  test("GET /working-schedules blocks branch managers from the tenant-wide list", async () => {
    const response = await request(app)
      .get("/working-schedules")
      .set(
        "Authorization",
        `Bearer ${generateToken({ userId: "manager1", role: "BRANCH_MANAGER" })}`,
      );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "Forbidden: You don't have permission to read_all schedules",
    });
  });

  test("GET /working-schedules/branches returns branch-scoped schedules", async () => {
    WorkingScheduleService.getBranchWorkingSchedules.mockResolvedValue({
      data: [{ _id: "schedule1", status: "SCHEDULED" }],
      pagination: {
        total: 1,
        page: 1,
        recordPerPage: 10,
        totalPage: 1,
      },
    });

    const token = jwt.sign(
      {
        userId: "branchManager1",
        phoneNumber: "0901000001",
        role: "BRANCH_MANAGER",
        tenantId: "tenant1",
        branchId: "branch1",
      },
      process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    const response = await request(app)
      .get("/working-schedules/branches")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [{ _id: "schedule1", status: "SCHEDULED" }],
      pagination: {
        total: 1,
        page: 1,
        recordPerPage: 10,
        totalPage: 1,
      },
    });
    expect(WorkingScheduleService.getBranchWorkingSchedules).toHaveBeenCalledWith(
      "tenant1",
      "branch1",
      {},
    );
  });

  test("GET /working-schedules/warehouses returns warehouse-scoped schedules", async () => {
    WorkingScheduleService.getWarehouseWorkingSchedules.mockResolvedValue({
      data: [{ _id: "schedule2", status: "SCHEDULED" }],
      pagination: {
        total: 1,
        page: 1,
        recordPerPage: 10,
        totalPage: 1,
      },
    });

    const token = jwt.sign(
      {
        userId: "warehouseManager1",
        phoneNumber: "0901000001",
        role: "WAREHOUSE_MANAGER",
        tenantId: "tenant1",
        warehouseId: "warehouse1",
      },
      process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    const response = await request(app)
      .get("/working-schedules/warehouses")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [{ _id: "schedule2", status: "SCHEDULED" }],
      pagination: {
        total: 1,
        page: 1,
        recordPerPage: 10,
        totalPage: 1,
      },
    });
    expect(
      WorkingScheduleService.getWarehouseWorkingSchedules,
    ).toHaveBeenCalledWith("tenant1", "warehouse1", {});
  });

  test("GET /working-schedules/branches blocks staff", async () => {
    const response = await request(app)
      .get("/working-schedules/branches")
      .set(
        "Authorization",
        `Bearer ${generateToken({ userId: "staffA", role: "STAFF" })}`,
      );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "Forbidden: You don't have permission to readBR schedules",
    });
  });

  test("GET /working-schedules/warehouses blocks staff", async () => {
    const response = await request(app)
      .get("/working-schedules/warehouses")
      .set(
        "Authorization",
        `Bearer ${generateToken({ userId: "staffA", role: "STAFF" })}`,
      );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "Forbidden: You don't have permission to readWH schedules",
    });
  });

  test("GET /working-schedules/:scheduleId/users/:userId returns one user's full detail", async () => {
    WorkingScheduleService.getWorkingScheduleUserDetail.mockResolvedValue({
      _id: "schedule1",
      status: "SCHEDULED",
      user: {
        _id: "staffA",
        role: "STAFF",
        attendance: {
          _id: "attendance1",
          status: "CHECKED_OUT",
          actualCheckinAt: "2026-07-01T01:03:00.000Z",
          actualCheckoutAt: "2026-07-01T05:05:00.000Z",
          workedMinutes: 242,
          overtimeMinute: 5,
          lateMinutes: 3,
        },
      },
    });

    const response = await request(app)
      .get("/working-schedules/schedule1/users/staffA")
      .set("Authorization", `Bearer ${generateToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      _id: "schedule1",
      status: "SCHEDULED",
      user: {
        _id: "staffA",
        role: "STAFF",
        attendance: {
          _id: "attendance1",
          status: "CHECKED_OUT",
          actualCheckinAt: "2026-07-01T01:03:00.000Z",
          actualCheckoutAt: "2026-07-01T05:05:00.000Z",
          workedMinutes: 242,
          overtimeMinute: 5,
          lateMinutes: 3,
        },
      },
    });
    expect(
      WorkingScheduleService.getWorkingScheduleUserDetail,
    ).toHaveBeenCalledWith("tenant1", "schedule1", "staffA");
  });

  test("GET /working-schedules/:scheduleId/users/:userId blocks staff from another user's detail", async () => {
    const response = await request(app)
      .get("/working-schedules/schedule1/users/staffB")
      .set(
        "Authorization",
        `Bearer ${generateToken({ userId: "staffA", role: "STAFF" })}`,
      );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "Forbidden: You can only access your own schedule detail",
    });
    expect(
      WorkingScheduleService.getWorkingScheduleUserDetail,
    ).not.toHaveBeenCalled();
  });

  test("GET /working-schedules/:scheduleId/users/:userId blocks managers outside role hierarchy", async () => {
    WorkingScheduleService.getWorkingScheduleUserDetail.mockResolvedValue({
      _id: "schedule1",
      status: "SCHEDULED",
      user: {
        _id: "warehouseManager1",
        role: "WAREHOUSE_MANAGER",
        attendance: {
          status: "NOT_CHECKED_IN",
          actualCheckinAt: null,
          actualCheckoutAt: null,
        },
      },
    });

    const response = await request(app)
      .get("/working-schedules/schedule1/users/warehouseManager1")
      .set(
        "Authorization",
        `Bearer ${generateToken({ userId: "branchManager1", role: "BRANCH_MANAGER" })}`,
      );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "Forbidden: You do not have permission to access this staff schedule detail",
    });
  });
});
