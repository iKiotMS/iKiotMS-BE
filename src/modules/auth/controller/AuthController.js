const AuthService = require("../service/AuthService");
const LoginRequestDTO = require("../dto/LoginRequestDTO");
const LoginResponseDTO = require("../dto/LoginResponseDTO");
const RegisterRequestDTO = require("../dto/RegisterRequestDTO");
const UserProfileResponseDTO = require("../dto/UserProfileResponseDTO");

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

      registerDTO.validate();

      await AuthService.register(registerDTO);

      res.status(201).json({
        success: true,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "Registration failed",
      });
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

  async getProfile(req, res) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { user, subscription } = await AuthService.getUserProfile(userId);

      const response = new UserProfileResponseDTO(user, subscription);

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      if (error.message === "User not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch profile",
      });
    }
  }

  async updateProfile(req, res) {
    try {
      const userId = req.user?.userId;
      const tenantId = req.user?.tenantId;
      const userRole = req.user?.role;

      if (!userId || !tenantId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const updatedUser = await AuthService.updateProfile(userId, tenantId, req.body, userRole);

      res.status(200).json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update profile",
      });
    }
  }
}

module.exports = new AuthController();
