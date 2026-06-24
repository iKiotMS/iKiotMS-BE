const { Subscription, Tenant, User, Plan, SubscriptionInvoice } = require("../../../models");
const sepayService = require("../../../services/sepayService");

class SubscriptionService {
  // Keeping this method for backward compatibility or potential future use
  async createTrialSubscription(
    tenantOwnerData,
    tenantData,
    planCode = "FREE_TRIAL",
  ) {
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
        isActive: true,
      });

      if (!plan) {
        throw new Error(`Plan with code ${planCode} not found or not active`);
      }

      // 3. Calculate trial dates
      const startDate = new Date();
      const trialEndDate = new Date(
        startDate.getTime() + plan.trialDays * 24 * 60 * 60 * 1000,
      );
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
        },
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
          maxProducts: plan.maxProducts,
        },
        historyLogs: [
          {
            event: "CREATED",
            fromPlanId: null,
            toPlanId: plan._id,
            changedAt: new Date(),
            changedBy: user._id,
            note: `Account created with ${plan.trialDays}-day free trial`,
          },
        ],
      });

      return {
        tenant: tenant.toObject({ getters: true }),
        user: user.toObject({ getters: true }),
        subscription: subscription.toObject({ getters: true }),
        plan: plan.toObject({ getters: true }),
      };
    } catch (error) {
      throw error;
    }
  }

  async createSubscriptionForExistingTenant(
    tenantId,
    userId,
    planCode = "FREE_TRIAL",
  ) {
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
        isActive: true,
      });

      if (!plan) {
        throw new Error(`Plan with code ${planCode} not found or not active`);
      }

      // 5. Calculate trial dates
      const startDate = new Date();
      const trialEndDate = new Date(
        startDate.getTime() + plan.trialDays * 24 * 60 * 60 * 1000,
      );
      const endDate = new Date(trialEndDate); // For trial, end date equals trial end date

      // 6. Check if tenant already has a subscription
      const existingSubscription = await Subscription.findOne({
        tenantId: tenant._id,
      });
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
          maxProducts: plan.maxProducts,
        },
        historyLogs: [
          {
            event: "CREATED",
            fromPlanId: null,
            toPlanId: plan._id,
            changedAt: new Date(),
            changedBy: user._id,
            note: `Free trial assigned to existing account`,
          },
        ],
      });

      return {
        tenant: tenant.toObject({ getters: true }),
        user: user.toObject({ getters: true }),
        subscription: subscription.toObject({ getters: true }),
        plan: plan.toObject({ getters: true }),
      };
    } catch (error) {
      throw error;
    }
  }

  async getSubscriptionByTenantId(tenantId) {
    return await Subscription.findOne({ tenantId }).populate("planId").lean();
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
          daysOverdue: Math.ceil(
            (now - subscription.trialEndDate) / (24 * 60 * 60 * 1000),
          ),
        };
      } else {
        // Trial is active
        const daysLeft = Math.ceil(
          (subscription.trialEndDate - now) / (24 * 60 * 60 * 1000),
        );
        return {
          hasTrial: true,
          status: "ACTIVE_TRIAL",
          daysLeft: daysLeft,
          trialEndDate: subscription.trialEndDate,
        };
      }
    }

    return {
      hasTrial: subscription.status === "TRIAL",
      status: subscription.status,
    };
  }

  async initiateUpgrade(tenantId, userId, planCode) {
    const currentSubscription = await Subscription.findOne({ tenantId });
    if (!currentSubscription) throw new Error("No active subscription found");

    const newPlan = await Plan.findOne({ planCode, isActive: true });
    if (!newPlan) throw new Error(`Plan ${planCode} not found or inactive`);

    if (newPlan.price === 0) throw new Error("Use free-trial endpoint for free plans");

    // Cancel any stale pending invoice for the same tenant+plan
    await SubscriptionInvoice.updateMany(
      { tenantId, planId: newPlan._id, status: 'PENDING' },
      { status: 'FAILED' },
    );

    const billingStart = new Date();
    const billingEnd = new Date(billingStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    const paymentReference = sepayService.generatePaymentReference();

    const invoice = await SubscriptionInvoice.create({
      subscriptionId: currentSubscription._id,
      tenantId,
      planId: newPlan._id,
      amount: newPlan.price,
      currency: 'VND',
      status: 'PENDING',
      paymentReference,
      paymentMethod: 'SEPAY',
      billingPeriodStart: billingStart,
      billingPeriodEnd: billingEnd,
    });

    const qrDataUrl = sepayService.buildQrUrl(newPlan.price, paymentReference);

    return {
      invoiceId: invoice._id,
      paymentReference,
      amount: newPlan.price,
      plan: { planCode: newPlan.planCode, planName: newPlan.planName },
      qrDataUrl,
      expiredAt: new Date(Date.now() + 15 * 60 * 1000), // QR valid 15 minutes
    };
  }

  async activateAfterPayment(invoice, sepayPayload) {
    const plan = await Plan.findById(invoice.planId);
    if (!plan) throw new Error("Plan not found");

    const subscription = await Subscription.findById(invoice.subscriptionId);
    if (!subscription) throw new Error("Subscription not found");

    const oldPlanId = subscription.planId;
    const billingStart = new Date();
    const billingEnd = new Date(billingStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    subscription.planId = plan._id;
    subscription.status = 'ACTIVE';
    subscription.startDate = billingStart;
    subscription.endDate = billingEnd;
    subscription.trialEndDate = null;
    subscription.currentQuotaSnapshot = {
      maxBranches: plan.maxBranches,
      maxUsers: plan.maxUsers,
      maxProducts: plan.maxProducts,
    };
    subscription.historyLogs.push({
      event: 'UPGRADED',
      fromPlanId: oldPlanId,
      toPlanId: plan._id,
      changedAt: new Date(),
      changedBy: invoice.tenantId,
      note: `Upgraded to ${plan.planCode} via SePay (ref: ${invoice.paymentReference})`,
    });
    await subscription.save();

    invoice.status = 'PAID';
    invoice.paidAt = new Date();
    invoice.transactionRef = sepayPayload.referenceCode ?? String(sepayPayload.id);
    await invoice.save();

    return subscription;
  }

  async upgradePlan(tenantId, userId, newPlanCode) {
    try {
      // 1. Find current subscription
      const currentSubscription = await Subscription.findOne({ tenantId });
      if (!currentSubscription) {
        throw new Error("No active subscription found");
      }

      // 2. Find new plan
      const newPlan = await Plan.findOne({
        planCode: newPlanCode,
        isActive: true,
      });
      if (!newPlan) {
        throw new Error(`Plan ${newPlanCode} not found or inactive`);
      }

      // 3. Get old plan for logging
      const oldPlan = await Plan.findById(currentSubscription.planId);

      // 4. Update subscription
      const oldPlanId = currentSubscription.planId;
      currentSubscription.planId = newPlan._id;
      currentSubscription.status = 'ACTIVE';
      currentSubscription.startDate = new Date();
      currentSubscription.endDate = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      );
      currentSubscription.trialEndDate = null;

      // 5. Update quota snapshot
      currentSubscription.currentQuotaSnapshot = {
        maxBranches: newPlan.maxBranches,
        maxUsers: newPlan.maxUsers,
        maxProducts: newPlan.maxProducts,
      };

      // 6. Log the upgrade
      currentSubscription.historyLogs.push({
        event: 'UPGRADED',
        fromPlanId: oldPlanId,
        toPlanId: newPlan._id,
        changedAt: new Date(),
        changedBy: userId,
        note: `Upgraded from ${oldPlan?.planCode} to ${newPlanCode}`,
      });

      await currentSubscription.save();

      return {
        subscription: currentSubscription.toObject({ getters: true }),
        oldPlan: oldPlan?.toObject({ getters: true }),
        newPlan: newPlan.toObject({ getters: true }),
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new SubscriptionService();
