const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../src/modules/payroll/service/PayrollService", () => ({
  generatePayRoll: jest.fn(),
  generatePayrollPeriod: jest.fn(),
  updateDraftPayslip: jest.fn(),
  changePayrollPeriodStatus: jest.fn(),
  listMyPayslips: jest.fn(),
  getMyPayslip: jest.fn(),
}));

jest.mock("../../src/utils/redisTest", () => {
  return jest.requireActual("express").Router();
});

const { createApp } = require("../../src/app");
const PayrollService = require("../../src/modules/payroll/service/PayrollService");

describe("Payroll preview API", () => {
  const app = createApp();
  const tenantId = "64a000000000000000000001";
  const userId = "64a000000000000000000002";

  const token = jwt.sign(
    {
      userId,
      tenantId,
      role: "TENANT_OWNER",
      phoneNumber: "0901000001",
    },
    process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
  const staffToken = jwt.sign(
    {
      userId,
      tenantId,
      role: "STAFF",
      phoneNumber: "0901000002",
    },
    process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /payroll/preview returns the calculated preview", async () => {
    PayrollService.generatePayRoll.mockResolvedValue({
      message: "Tính bảng lương nháp thành công",
      data: {
        periodStart: "2026-07-01T00:00:00.000Z",
        periodEnd: "2026-07-31T23:59:59.999Z",
        payslips: [
          {
            userId,
            basePay: 12000000,
            overtimePay: 150000,
            grossSalary: 12150000,
            netSalary: 12150000,
          },
        ],
        skipped: [],
        summary: {
          totalEmployees: 1,
          generatedCount: 1,
          skippedCount: 0,
          totalBasePay: 12000000,
          totalOvertimePay: 150000,
          totalGrossSalary: 12150000,
          totalNetSalary: 12150000,
        },
      },
    });

    const body = {
      periodStartDate: "2026-07-01",
      periodEndDate: "2026-07-31",
      userIds: [userId],
    };
    const response = await request(app)
      .post("/payroll/preview")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Tính bảng lương nháp thành công",
      data: {
        summary: {
          generatedCount: 1,
          totalGrossSalary: 12150000,
        },
      },
    });
    expect(PayrollService.generatePayRoll).toHaveBeenCalledWith({
      tenantId,
      currentUserId: userId,
      payrollData: body,
    });
  });

  test("POST /payroll/preview returns service validation errors", async () => {
    const error = new Error("Dữ liệu tạo bảng lương không hợp lệ");
    error.statusCode = 400;
    error.errors = { periodEndDate: "periodEndDate không hợp lệ" };
    PayrollService.generatePayRoll.mockRejectedValue(error);

    const response = await request(app)
      .post("/payroll/preview")
      .set("Authorization", `Bearer ${token}`)
      .send({ periodStartDate: "2026-07-01", periodEndDate: "invalid" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Dữ liệu tạo bảng lương không hợp lệ",
      errors: { periodEndDate: "periodEndDate không hợp lệ" },
    });
  });

  test("POST /payroll/periods creates a draft payroll period", async () => {
    PayrollService.generatePayrollPeriod.mockResolvedValue({
      message: "Tạo kỳ lương nháp thành công",
      data: {
        payrollPeriod: { _id: "period1", status: "DRAFT" },
        payslips: [{ _id: "payslip1", status: "DRAFT" }],
        skipped: [],
        summary: { generatedCount: 1, skippedCount: 0 },
      },
    });

    const response = await request(app)
      .post("/payroll/periods")
      .set("Authorization", `Bearer ${token}`)
      .send({ payrollMonth: "2026-07" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Tạo kỳ lương nháp thành công",
      data: {
        payrollPeriod: { status: "DRAFT" },
        summary: { generatedCount: 1 },
      },
    });
    expect(PayrollService.generatePayrollPeriod).toHaveBeenCalledWith({
      tenantId,
      currentUserId: userId,
      payrollData: { payrollMonth: "2026-07" },
    });
  });

  test("PATCH draft payslip updates manual adjustments", async () => {
    PayrollService.updateDraftPayslip.mockResolvedValue({
      manualAdjustmentTotal: -500000,
      payslip: { _id: "payslip1", netSalary: 9500000 },
    });
    const body = {
      manualAdjustments: [
        { category: "SALARY_ADVANCE", name: "Ứng lương", amount: -500000 },
      ],
    };
    const response = await request(app)
      .patch(
        "/payroll/periods/64a000000000000000000011/payslips/64a000000000000000000012",
      )
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { manualAdjustmentTotal: -500000 },
    });
  });

  test("POST submit moves a payroll period to review", async () => {
    PayrollService.changePayrollPeriodStatus.mockResolvedValue({
      _id: "period1",
      status: "REVIEW",
    });
    const response = await request(app)
      .post("/payroll/periods/64a000000000000000000011/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(200);
    expect(PayrollService.changePayrollPeriodStatus).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SUBMIT" }),
    );
  });

  test("GET /payroll/my-payslips lets staff read only their own published payslips", async () => {
    PayrollService.listMyPayslips.mockResolvedValue({
      data: [{ _id: "payslip1", status: "APPROVED" }],
      pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });

    const response = await request(app)
      .get("/payroll/my-payslips")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      { _id: "payslip1", status: "APPROVED" },
    ]);
    expect(PayrollService.listMyPayslips).toHaveBeenCalledWith({
      tenantId,
      userId,
      query: {},
    });
  });
});
