const jwt = require("jsonwebtoken");
const { User, RefreshToken } = require("../../../models");

class AuthService {
  async login(email, password, userAgent) {
    const user = await User.findOne({ email }).lean();

    if (!user) {
      throw new Error("Invalid email or password");
    }

    if (user.status === "SUSPENDED" || user.status === "INACTIVE") {
      throw new Error("User account is not active");
    }

    const passwordMatch = await this.validateCredentials(email, password);
    if (!passwordMatch) {
      throw new Error("Invalid email or password");
    }

    const tokens = this.generateTokens(user);

    await RefreshToken.create({
      userId: user._id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent,
      isRevoked: false,
    });

    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    };
  }

  async validateCredentials(email, password) {
    const user = await User.findOne({ email });

    if (!user) {
      return false;
    }

    return await user.comparePassword(password);
  }

  generateTokens(user) {
    const accessToken = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      {
        userId: user._id,
        type: "refresh",
      },
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return { accessToken, refreshToken };
  }

  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
      );

      const storedToken = await RefreshToken.findOne({
        token: refreshToken,
        isRevoked: false,
        expiresAt: { $gt: new Date() },
      });

      if (!storedToken) {
        throw new Error("Refresh token is invalid or revoked");
      }

      const user = await User.findById(decoded.userId).lean();
      if (!user) {
        throw new Error("User not found");
      }

      const tokens = this.generateTokens(user);

      await RefreshToken.updateOne(
        { _id: storedToken._id },
        { isRevoked: true },
      );

      await RefreshToken.create({
        userId: user._id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: storedToken.userAgent,
        isRevoked: false,
      });

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }

  async logout(userId, refreshToken) {
    await RefreshToken.updateOne(
      { token: refreshToken, userId },
      { isRevoked: true },
    );
  }
}

module.exports = new AuthService();
