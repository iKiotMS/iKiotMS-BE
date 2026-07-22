const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../../src/modules/auth/service/AuthService", () => ({
  changePassword: jest.fn(),
  sendForgotPasswordOtp: jest.fn(),
  verifyForgotPasswordOtp: jest.fn(),
  resetPassword: jest.fn(),
}));

jest.mock("../../src/utils/redisTest", () => {
  return jest.requireActual("express").Router();
});

const { createApp } = require("../../src/app");
const AuthService = require("../../src/modules/auth/service/AuthService");

describe("Auth Password Management Route Tests (SMS OTP)", () => {
  const app = createApp();
  const tenantId = "64a000000000000000000001";
  const userId = "64a000000000000000000002";
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "defaultsecret";

  const ownerToken = jwt.sign(
    { userId, tenantId, role: "TENANT_OWNER", phoneNumber: "0901000001" },
    secret,
    { expiresIn: "15m" }
  );

  beforeEach(() => jest.clearAllMocks());

  describe("POST /auth/change-password", () => {
    test("Fails without authorization header", async () => {
      const res = await request(app)
        .post("/auth/change-password")
        .send({ currentPassword: "OldPassword123", newPassword: "NewPassword123" });
      expect(res.status).toBe(401);
    });

    test("Calls AuthService.changePassword and returns success", async () => {
      AuthService.changePassword.mockResolvedValue({ message: "Đổi mật khẩu thành công" });

      const res = await request(app)
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          currentPassword: "OldPassword123",
          newPassword: "NewPassword123",
          confirmPassword: "NewPassword123",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(AuthService.changePassword).toHaveBeenCalledWith(userId, "OldPassword123", "NewPassword123");
    });
  });

  describe("POST /auth/send-forgot-password-otp", () => {
    test("Fails without phoneNumber", async () => {
      const res = await request(app).post("/auth/send-forgot-password-otp").send({});
      expect(res.status).toBe(400);
    });

    test("Calls AuthService.sendForgotPasswordOtp", async () => {
      AuthService.sendForgotPasswordOtp.mockResolvedValue({ message: "Đã gửi mã OTP" });

      const res = await request(app)
        .post("/auth/send-forgot-password-otp")
        .send({ phoneNumber: "0912345678" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(AuthService.sendForgotPasswordOtp).toHaveBeenCalledWith("0912345678");
    });
  });

  describe("POST /auth/verify-forgot-password-otp", () => {
    test("Fails without OTP code", async () => {
      const res = await request(app)
        .post("/auth/verify-forgot-password-otp")
        .send({ phoneNumber: "0912345678" });
      expect(res.status).toBe(400);
    });

    test("Calls AuthService.verifyForgotPasswordOtp and returns resetToken", async () => {
      AuthService.verifyForgotPasswordOtp.mockResolvedValue({
        resetToken: "mock-reset-jwt-token",
        message: "Xác thực mã OTP thành công.",
      });

      const res = await request(app)
        .post("/auth/verify-forgot-password-otp")
        .send({ phoneNumber: "0912345678", otpCode: "123456" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.resetToken).toBe("mock-reset-jwt-token");
      expect(AuthService.verifyForgotPasswordOtp).toHaveBeenCalledWith("0912345678", "123456");
    });
  });

  describe("POST /auth/reset-password", () => {
    test("Calls AuthService.resetPassword with resetToken", async () => {
      AuthService.resetPassword.mockResolvedValue({ message: "Đặt lại mật khẩu thành công" });

      const res = await request(app)
        .post("/auth/reset-password")
        .send({
          resetToken: "mock-reset-jwt-token",
          newPassword: "NewPassword123",
          confirmPassword: "NewPassword123",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(AuthService.resetPassword).toHaveBeenCalledWith("mock-reset-jwt-token", "NewPassword123");
    });
  });
});
