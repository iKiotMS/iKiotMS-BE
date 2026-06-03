const AuthService = require("../service/AuthService");
const LoginRequestDTO = require("../dto/LoginRequestDTO");
const LoginResponseDTO = require("../dto/LoginResponseDTO");
const RegisterRequestDTO = require("../dto/RegisterRequestDTO");

const { User } = require("../../../models");
const { Tenant } = require("../../../models");
const RefreshToken = require("../../../models/RefreshToken");
const {
  SubscriptionService,
} = require("../../subscription/service/SubscriptionService");

class AuthController {
  async login(req, res) {
    try {
      const { phoneNumber, password } = req.body;

      const loginDTO = new LoginRequestDTO(phoneNumber, password);
      const validation = loginDTO.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const userAgent = req.headers["user-agent"];
      const result = await AuthService.login(phoneNumber, password, userAgent);

      const response = new LoginResponseDTO(
        result.accessToken,
        result.refreshToken,
        result.user,
      );

      res.status(200).json(response);
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message || "Login failed",
      });
    }
  }

  async register(req, res) {
    try {
      console.log("A");

      const {
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        tenantName,
        tenantPhoneNumber,
        tenantMainAddress,
        tenantTaxNumber,
      } = req.body;

      console.log("B");

      const registerDTO = new RegisterRequestDTO(
        email,
        phoneNumber,
        password,
        firstName,
        lastName,
        tenantName,
        tenantPhoneNumber,
        tenantMainAddress,
        tenantTaxNumber,
      );

      console.log("C");

      const validation = registerDTO.validate();

      console.log("D");

      const { user, tenant } = await AuthService.register(registerDTO);

      console.log("E");

      res.status(201).json({
        success: true,
      });
    } catch (error) {
      console.error(error);
      console.error(error.stack);
    }
  }

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      const tokens = await AuthService.refreshAccessToken(refreshToken);

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message || "Token refresh failed",
      });
    }
  }

  async logout(req, res) {
    try {
      const userId = req.user?.userId;
      const refreshToken = req.body?.refreshToken;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (refreshToken) {
        await AuthService.logout(userId, refreshToken);
      }

      res.status(200).json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || "Logout failed",
      });
    }
  }
}

module.exports = new AuthController();
