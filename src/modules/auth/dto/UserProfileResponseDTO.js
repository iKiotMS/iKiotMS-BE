class UserProfileResponseDTO {
  constructor(user, subscription = null, tenant = null) {
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
        planCode: subscription.planId?.planCode,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        trialEndDate: subscription.trialEndDate,
        autoRenew: subscription.autoRenew,
        currentQuotaSnapshot: subscription.currentQuotaSnapshot,
      };
    }

    // Add tenant info
    if (tenant) {
      this.tenant = {
        id: tenant._id,
        name: tenant.name,
        phoneNumber: tenant.phoneNumber,
        mainAddress: tenant.mainAddress,
        taxNumber: tenant.taxNumber,
        banking: tenant.banking,
        status: tenant.status,
      };
    }
  }
}

module.exports = UserProfileResponseDTO;
