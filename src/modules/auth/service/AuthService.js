const jwt = require("jsonwebtoken");
const { User, RefreshToken, Tenant } = require("../../../models");
const Subscription = require("../../../models/Subscription");
const Plan = require("../../../models/Plan");
const otpService = require("../../../services/otpService");

class AuthService {
  async login(phoneNumber, password, userAgent) {
    const user = await User.findOne({ phoneNumber }).lean();

    if (!user) {
      throw new Error("Invalid phone number or password");
    }

    if (
      user.status === "SUSPENDED" ||
      user.status === "INACTIVE" ||
      user.status === "DELETED"
    ) {
      throw new Error("User account is not active");
    }

    const passwordMatch = await this.validateCredentials(phoneNumber, password);
    if (!passwordMatch) {
      throw new Error("Invalid phone number or password");
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

  async validateCredentials(phoneNumber, password) {
    const user = await User.findOne({ phoneNumber });

    if (!user || !user.password) {
      return false;
    }

    return await user.comparePassword(password);
  }

  generateTokens(user) {
    const accessToken = jwt.sign(
      {
        userId: user._id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        tenantId: user.tenantId,
        branchId: user.branchId,
        warehouseId: user.warehouseId,
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

  async register(userData) {
    const {
      email,
      phoneNumber,
      password,
      firstName,
      lastName,
      tenantName,
      tenantMainAddress,
      tenantTaxNumber,
      otpCode,
    } = userData;

    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      throw new Error("Phone number already in use");
    }

    const existingTenant = await Tenant.findOne({ name: tenantName });
    if (existingTenant) {
      throw new Error("Tenant name already in use");
    }

    // Verify the phone number was confirmed via the SMS OTP sent through eSMS
    // before creating any records. In dev this is bypassed (see otpService).
    await otpService.verifyOtp(phoneNumber, otpCode);

    const tenant = await Tenant.create({
      name: tenantName,
      phoneNumber: phoneNumber || "",
      mainAddress: tenantMainAddress || "",
      taxNumber: tenantTaxNumber || "",
      tenantOwnerId: null,
    });

    const user = await User.create({
      email,
      phoneNumber,
      password,
      role: "TENANT_OWNER",
      tenantId: tenant._id,
      profile: {
        firstName: firstName || "",
        lastName: lastName || "",
        phoneNumber: phoneNumber || "",
      },
    });

    tenant.tenantOwnerId = user._id;
    await tenant.save();

    return { user, tenant };
  }

  async getUserProfile(userId) {
    const user = await User.findById(userId).lean();

    if (!user) {
      throw new Error("User not found");
    }

    let subscription = null;

    // If user is TENANT_OWNER, fetch subscription with plan details
    if (user.role === "TENANT_OWNER") {
      subscription = await Subscription.findOne({
        tenantId: user.tenantId,
      })
        .populate("planId", "planName planCode price features")
        .lean();
    }

    return { user, subscription };
  }

  async updateProfile(userId, tenantId, data) {
    const user = await User.findOne({ _id: userId, tenantId });
    if (!user) {
      throw new Error("User not found");
    }

    const flatUpdate = {};

    // 1. Handle root level fields (like email)
    if (user.role === "TENANT_OWNER" && data.email !== undefined) {
      if (data.email !== user.email) {
        const existingEmail = await User.findOne({
          tenantId,
          email: data.email.toLowerCase().trim(),
          _id: { $ne: userId },
        });
        if (existingEmail) {
          throw new Error("Email already exists");
        }
      }
      flatUpdate.email = data.email;
    }

    // 2. Handle nested profile fields based on role permissions
    const tenantOnlyProfileFields = [
      "firstName",
      "lastName",
      "identificationId",
      "taxNumber",
      "address",
      "gender",
      "dob",
    ];
    const publicProfileFields = ["avatarUrl"];

    const allowedProfileFields = user.role === "TENANT_OWNER"
      ? [...tenantOnlyProfileFields, ...publicProfileFields]
      : publicProfileFields;

    allowedProfileFields.forEach((field) => {
      if (data.profile?.[field] !== undefined) {
        flatUpdate[`profile.${field}`] = data.profile[field];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: flatUpdate },
      { new: true, runValidators: true },
    ).select("-password");

    return updatedUser;
  }
}

module.exports = new AuthService();
