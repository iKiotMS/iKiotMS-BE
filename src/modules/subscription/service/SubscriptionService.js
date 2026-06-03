const { Subscription, Tenant, User, Plan } = require("../../../models");

class SubscriptionService {
  // Keeping this method for backward compatibility or potential future use
  async createTrialSubscription(tenantOwnerData, tenantData, planCode = "FREE_TRIAL") {
    try {
      // 1. Create the tenant
      const tenant = await Tenant.create({
        name: tenantData.name,
        phoneNumber: tenantData.phoneNumber || "",
        mainAddress: tenantData.mainAddress || "",
        taxNumber: tenantData.taxNumber || "",
        tenantOwnerId: null, // Will be set after user creation
      });

      // 2. Find the free trial plan
      const plan = await Plan.findOne({
        planCode: planCode,
        isActive: true
      });

      if (!plan) {
        throw new Error(`Plan with code ${planCode} not found or not active`);
      }

      // 3. Calculate trial dates
      const startDate = new Date();
      const trialEndDate = new Date(startDate.getTime() + (plan.trialDays * 24 * 60 * 60 * 1000));
      const endDate = new Date(trialEndDate); // For trial, end date equals trial end date

      // 4. Create the user (tenant owner)
      const user = await User.create({
        phoneNumber: tenantOwnerData.phoneNumber,
        password: tenantOwnerData.password,
        role: "TENANT_OWNER",
        tenantId: tenant._id,
        profile: {
          firstName: tenantOwnerData.firstName || "",
          lastName: tenantOwnerData.lastName || "",
          phoneNumber: tenantOwnerData.phoneNumber || "",
        }
      });

      // 5. Update tenant with owner ID
      tenant.tenantOwnerId = user._id;
      await tenant.save();

      // 6. Create subscription
      const subscription = await Subscription.create({
        tenantId: tenant._id,
        planId: plan._id,
        status: "TRIAL",
        startDate: startDate,
        endDate: endDate,
        trialEndDate: trialEndDate,
        autoRenew: true,
        currentQuotaSnapshot: {
          maxBranches: plan.maxBranches,
          maxUsers: plan.maxUsers,
          maxWarehouses: plan.maxWarehouses,
          maxProducts: plan.maxProducts,
        },
        historyLogs: [{
          event: "CREATED",
          fromPlanId: null,
          toPlanId: plan._id,
          changedAt: new Date(),
          changedBy: user._id,
          note: `Account created with ${plan.trialDays}-day free trial`
        }]
      });

      return {
        tenant: tenant.toObject({ getters: true }),
        user: user.toObject({ getters: true }),
        subscription: subscription.toObject({ getters: true }),
        plan: plan.toObject({ getters: true })
      };
    } catch (error) {
      throw error;
    }
  }

  async createSubscriptionForExistingTenant(tenantId, userId, planCode = "FREE_TRIAL") {
    try {
      // 1. Find the tenant
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        throw new Error("Tenant not found");
      }

      // 2. Find the user
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // 3. Verify user belongs to tenant
      if (user.tenantId.toString() !== tenant._id.toString()) {
        throw new Error("User does not belong to this tenant");
      }

      // 4. Find the free trial plan
      const plan = await Plan.findOne({
        planCode: planCode,
        isActive: true
      });

      if (!plan) {
        throw new Error(`Plan with code ${planCode} not found or not active`);
      }

      // 5. Calculate trial dates
      const startDate = new Date();
      const trialEndDate = new Date(startDate.getTime() + (plan.trialDays * 24 * 60 * 60 * 1000));
      const endDate = new Date(trialEndDate); // For trial, end date equals trial end date

      // 6. Check if tenant already has a subscription
      const existingSubscription = await Subscription.findOne({ tenantId: tenant._id });
      if (existingSubscription) {
        throw new Error("Tenant already has a subscription");
      }

      // 7. Create subscription
      const subscription = await Subscription.create({
        tenantId: tenant._id,
        planId: plan._id,
        status: "TRIAL",
        startDate: startDate,
        endDate: endDate,
        trialEndDate: trialEndDate,
        autoRenew: true,
        currentQuotaSnapshot: {
          maxBranches: plan.maxBranches,
          maxUsers: plan.maxUsers,
          maxWarehouses: plan.maxWarehouses,
          maxProducts: plan.maxProducts,
        },
        historyLogs: [{
          event: "CREATED",
          fromPlanId: null,
          toPlanId: plan._id,
          changedAt: new Date(),
          changedBy: user._id,
          note: `Free trial assigned to existing account`
        }]
      });

      return {
        tenant: tenant.toObject({ getters: true }),
        user: user.toObject({ getters: true }),
        subscription: subscription.toObject({ getters: true }),
        plan: plan.toObject({ getters: true })
      };
    } catch (error) {
      throw error;
    }
  }

  async getSubscriptionByTenantId(tenantId) {
    return await Subscription.findOne({ tenantId })
      .populate("planId")
      .lean();
  }

  async checkTrialStatus(tenantId) {
    const subscription = await this.getSubscriptionByTenantId(tenantId);

    if (!subscription) {
      return { hasTrial: false, status: "NO_SUBSCRIPTION" };
    }

    const now = new Date();

    if (subscription.status === "TRIAL") {
      if (now > subscription.trialEndDate) {
        // Trial has expired
        return {
          hasTrial: false,
          status: "EXPIRED_TRIAL",
          daysOverdue: Math.ceil((now - subscription.trialEndDate) / (24 * 60 * 60 * 1000))
        };
      } else {
        // Trial is active
        const daysLeft = Math.ceil((subscription.trialEndDate - now) / (24 * 60 * 60 * 1000));
        return {
          hasTrial: true,
          status: "ACTIVE_TRIAL",
          daysLeft: daysLeft,
          trialEndDate: subscription.trialEndDate
        };
      }
    }

    return {
      hasTrial: subscription.status === "TRIAL",
      status: subscription.status
    };
  }
}

module.exports = new SubscriptionService();