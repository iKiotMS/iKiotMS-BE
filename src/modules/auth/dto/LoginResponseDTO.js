class LoginResponseDTO {
  constructor(accessToken, refreshToken, user) {
    this.success = true;
    this.message = "Login successful";
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      firstName: user.profile?.firstName || "",
      lastName: user.profile?.lastName || "",
      status: user.status,
    };
  }
}

module.exports = LoginResponseDTO;
