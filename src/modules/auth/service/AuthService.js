const jwt = require("jsonwebtoken");
const { User, RefreshToken, Tenant } = require("../../../models");
const Subscription = require("../../../models/Subscription");
const Plan = require("../../../models/Plan");
const otpService = require("../../../services/otpService");
const { sendPasswordResetEmail } = require("../../../services/emailService");
const { admin, isFirebaseConfigured } = require("../../../config/firebase");
const { STAFF_ROLES } = require("../../../constants/role");

// Marker messages for role-gated Google sign-in rejections. The controller
// maps errors carrying `isRoleDenied` to HTTP 403 (rather than 401).
const ROLE_DENIED_MOBILE =
  "Ứng dụng chỉ dành cho nhân viên và quản lý";
const ROLE_DENIED_WEB = "Tài khoản khách hàng không thể đăng nhập tại đây";

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

    return await this.issueSession(user, userAgent);
  }

  /**
   * Logs a user in via a Google (Firebase) ID token. The token is verified
   * with firebase-admin; the user is then resolved by the token's email —
   * so the account must have that email set on their profile beforehand
   * (there is no auto-provisioning here). `platform` picks the role gate:
   *   - "mobile": employee-only (STAFF_ROLES)
   *   - "web": every role except CUSTOMER
   */
  async firebaseLogin(idToken, platform, userAgent) {
    if (!isFirebaseConfigured()) {
      throw new Error("Đăng nhập Google chưa được cấu hình trên máy chủ");
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      throw new Error("Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn");
    }

    const email = (decoded.email || "").toLowerCase().trim();
    if (!email) {
      throw new Error("Tài khoản Google không có địa chỉ email");
    }
    if (decoded.email_verified === false) {
      throw new Error("Email Google chưa được xác thực");
    }

    // Match by email. No matching user → reject (the stated rule: an email
    // not present in the DB is refused).
    const user = await User.findOne({ email }).lean();
    if (!user) {
      throw new Error("Email này chưa được đăng ký trong hệ thống");
    }

    if (
      user.status === "SUSPENDED" ||
      user.status === "INACTIVE" ||
      user.status === "DELETED"
    ) {
      throw new Error("Tài khoản không hoạt động");
    }

    if (platform === "mobile") {
      if (!STAFF_ROLES.includes(user.role)) {
        const err = new Error(ROLE_DENIED_MOBILE);
        err.isRoleDenied = true;
        throw err;
      }
    } else if (user.role === "CUSTOMER") {
      const err = new Error(ROLE_DENIED_WEB);
      err.isRoleDenied = true;
      throw err;
    }

    return await this.issueSession(user, userAgent);
  }

  /**
   * Issues an access/refresh token pair for an already-authenticated user,
   * persists the refresh token, and stamps lastLogin. Shared by password and
   * Google sign-in.
   */
  async issueSession(user, userAgent) {
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
      { expiresIn: "1d" },
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
    let tenant = null;

    // If user is TENANT_OWNER, fetch subscription with plan details
    if (user.role === "TENANT_OWNER") {
      subscription = await Subscription.findOne({
        tenantId: user.tenantId,
      })
        .populate("planId", "planName planCode price features")
        .lean();
    }

    if (user.tenantId) {
      tenant = await Tenant.findById(user.tenantId)
        .select('+banking.sepayWebhookApiKey')
        .lean();
    }

    return { user, subscription, tenant };
  }

  async updateProfile(userId, tenantId, data) {
    const user = await User.findOne({ _id: userId, tenantId });
    if (!user) {
      throw new Error("User not found");
    }

    const flatUpdate = {};

    // 1. Handle root-level fields (email). Any role may set their own email —
    // it is the enrollment key for Google (Firebase) sign-in. Because sign-in
    // resolves the user by email across the whole collection, uniqueness is
    // enforced globally, not just within the tenant.
    if (data.email !== undefined) {
      const normalizedEmail = String(data.email).toLowerCase().trim();
      if (normalizedEmail && normalizedEmail !== (user.email || "")) {
        const existingEmail = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: userId },
        });
        if (existingEmail) {
          throw new Error("Email already exists");
        }
      }
      flatUpdate.email = normalizedEmail;
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

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }

    if (!user.password) {
      throw new Error("Tài khoản của bạn không sử dụng mật khẩu đăng nhập trực tiếp");
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new Error("Mật khẩu hiện tại không chính xác");
    }

    user.password = newPassword;
    await user.save();

    // Revoke old refresh tokens for security
    await RefreshToken.updateMany({ userId }, { isRevoked: true });

    return { message: "Đổi mật khẩu thành công" };
  }

  async sendForgotPasswordOtp(phoneNumber) {
    if (!phoneNumber || !String(phoneNumber).trim()) {
      throw new Error("Số điện thoại không được để trống");
    }

    const user = await User.findOne({
      phoneNumber: String(phoneNumber).trim(),
      status: { $ne: "DELETED" },
    });

    if (!user || user.status === "INACTIVE" || user.status === "SUSPENDED") {
      throw new Error("Số điện thoại chưa được đăng ký trong hệ thống hoặc tài khoản đã bị khóa.");
    }

    await otpService.sendOtp(phoneNumber);

    return { message: "Đã gửi mã OTP thành công đến số điện thoại của bạn." };
  }

  async verifyForgotPasswordOtp(phoneNumber, otpCode) {
    if (!phoneNumber || !String(phoneNumber).trim()) {
      throw new Error("Số điện thoại không được để trống");
    }
    if (!otpCode || !String(otpCode).trim()) {
      throw new Error("Mã OTP không được để trống");
    }

    const user = await User.findOne({
      phoneNumber: String(phoneNumber).trim(),
      status: { $ne: "DELETED" },
    });

    if (!user || user.status === "INACTIVE" || user.status === "SUSPENDED") {
      throw new Error("Số điện thoại chưa được đăng ký trong hệ thống hoặc tài khoản đã bị khóa.");
    }

    await otpService.verifyOtp(phoneNumber, otpCode);

    const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "defaultsecret";
    const resetToken = jwt.sign(
      { userId: user._id, phoneNumber: user.phoneNumber, type: "password_reset" },
      secret,
      { expiresIn: "15m" }
    );

    return { resetToken, message: "Xác thực mã OTP thành công." };
  }

  async resetPassword(token, newPassword) {
    if (!token) {
      throw new Error("Mã xác thực đặt lại mật khẩu không được để trống");
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự");
    }

    const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "defaultsecret";
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      throw new Error("Mã xác thực đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
    }

    if (decoded.type !== "password_reset") {
      throw new Error("Token không hợp lệ cho thao tác đặt lại mật khẩu");
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.status === "DELETED" || user.status === "INACTIVE" || user.status === "SUSPENDED") {
      throw new Error("Tài khoản không tồn tại hoặc đã bị khóa");
    }

    user.password = newPassword;
    await user.save();

    // Revoke all existing refresh tokens
    await RefreshToken.updateMany({ userId: user._id }, { isRevoked: true });

    return { message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại." };
  }
}

module.exports = new AuthService();
module.exports.ROLE_DENIED_MOBILE = ROLE_DENIED_MOBILE;
module.exports.ROLE_DENIED_WEB = ROLE_DENIED_WEB;
