const AuthService = require("../service/AuthService");
const LoginRequestDTO = require("../dto/LoginRequestDTO");
const LoginResponseDTO = require("../dto/LoginResponseDTO");

class AuthController {
  async login(req, res) {
    try {
      const { email, password } = req.body;

      const loginDTO = new LoginRequestDTO(email, password);
      const validation = loginDTO.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const userAgent = req.headers["user-agent"];
      const result = await AuthService.login(email, password, userAgent);

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
