class UserProfileResponseDTO {
  constructor(user, subscription = null) {
    this.id = user._id;
    this.phoneNumber = user.phoneNumber;
    this.email = user.email;
    this.role = user.role;
    this.status = user.status;
    this.tenantId = user.tenantId;
    this.branchId = user.branchId;
    this.warehouseId = user.warehouseId;
    this.profile = user.profile;
    this.lastLogin = user.lastLogin;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;

    // Add subscription info if tenant owner
    if (subscription) {
      this.subscription = {
        id: subscription._id,
        planName: subscription.planId?.planName,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        trialEndDate: subscription.trialEndDate,
        autoRenew: subscription.autoRenew,
        currentQuotaSnapshot: subscription.currentQuotaSnapshot,
      };
    }
  }
}

module.exports = UserProfileResponseDTO;
