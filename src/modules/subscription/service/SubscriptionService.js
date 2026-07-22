const mongoose = require("mongoose");
const {
  Subscription,
  Tenant,
  User,
  Plan,
  SubscriptionInvoice,
} = require("../../../models");
const sepayService = require("../../../services/sepayService");
const {
  GRACE_PERIOD_DAYS,
  QR_EXPIRY_MS,
  addDays,
  getBillingDays,
} = require("../../../constants/subscription");

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
      const trialEndDate = addDays(startDate, plan.trialDays);
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
    planCode = "TRIAL",
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
      return { status: "NO_SUBSCRIPTION" };
    }

    const now = new Date();

    if (subscription.status === "TRIAL") {
      if (now > new Date(subscription.trialEndDate)) {
        await Subscription.findByIdAndUpdate(subscription._id, {
          status: "EXPIRED",
        });
        return {
          status: "EXPIRED",
          daysOverdue: Math.ceil(
            (now - new Date(subscription.trialEndDate)) / 86400000,
          ),
        };
      }
      return {
        status: "TRIAL",
        daysLeft: Math.ceil(
          (new Date(subscription.trialEndDate) - now) / 86400000,
        ),
        trialEndDate: subscription.trialEndDate,
      };
    }

    if (subscription.status === "ACTIVE" || subscription.status === "PAST_DUE") {
      const endDate = new Date(subscription.endDate);
      const graceCutoff = addDays(now, -GRACE_PERIOD_DAYS);

      // Quá grace period → EXPIRED, chặn
      if (endDate < graceCutoff) {
        await Subscription.findByIdAndUpdate(subscription._id, {
          status: "EXPIRED",
        });
        return {
          status: "EXPIRED",
          daysOverdue: Math.ceil((now - endDate) / 86400000),
        };
      }

      // Quá hạn nhưng còn trong grace period → PAST_DUE, vẫn dùng được
      if (now > endDate) {
        if (subscription.status === "ACTIVE") {
          await Subscription.findByIdAndUpdate(subscription._id, {
            status: "PAST_DUE",
          });
        }
        return {
          status: "PAST_DUE",
          daysOverdue: Math.ceil((now - endDate) / 86400000),
          gracePeriodEndsAt: addDays(endDate, GRACE_PERIOD_DAYS),
          endDate: subscription.endDate,
          planCode: subscription.planId?.planCode,
        };
      }

      return {
        status: "ACTIVE",
        daysLeft: Math.ceil((endDate - now) / 86400000),
        endDate: subscription.endDate,
        planCode: subscription.planId?.planCode,
      };
    }

    return { status: subscription.status };
  }

  // Tạo invoice PENDING + QR cho một plan (dùng chung cho upgrade & renew)
  async _createPlanInvoice(subscription, plan) {
    // Huỷ các invoice pending cũ của cùng tenant+plan tránh duplicate
    await SubscriptionInvoice.updateMany(
      { tenantId: subscription.tenantId, planId: plan._id, status: "PENDING" },
      { status: "FAILED" },
    );

    const billingStart = new Date();
    const billingEnd = addDays(billingStart, getBillingDays(plan.billingCycle));
    const paymentReference = sepayService.generatePaymentReference();

    const invoice = await SubscriptionInvoice.create({
      subscriptionId: subscription._id,
      tenantId: subscription.tenantId,
      planId: plan._id,
      amount: plan.price,
      currency: "VND",
      status: "PENDING",
      paymentReference,
      paymentMethod: "SEPAY",
      billingPeriodStart: billingStart,
      billingPeriodEnd: billingEnd,
    });

    return {
      invoiceId: invoice._id,
      paymentReference,
      amount: plan.price,
      plan: { planCode: plan.planCode, planName: plan.planName },
      qrDataUrl: sepayService.buildQrUrl(plan.price, paymentReference),
      expiredAt: new Date(Date.now() + QR_EXPIRY_MS),
    };
  }

  async initiateUpgrade(tenantId, userId, planCode) {
    const currentSubscription = await Subscription.findOne({ tenantId });
    if (!currentSubscription) throw new Error("No active subscription found");

    const newPlan = await Plan.findOne({ planCode, isActive: true });
    if (!newPlan) throw new Error(`Plan ${planCode} not found or inactive`);

    if (newPlan.price === 0)
      throw new Error("Use free-trial endpoint for free plans");

    return this._createPlanInvoice(currentSubscription, newPlan);
  }

  async initiateRenewal(tenantId) {
    const currentSubscription = await Subscription.findOne({ tenantId }).populate("planId");
    if (!currentSubscription) throw new Error("No subscription found");

    const currentPlan = currentSubscription.planId;
    if (!currentPlan) throw new Error("Current plan not found");

    if (currentPlan.planCode === "TRIAL" || currentPlan.price === 0) {
      throw new Error("Trial plan cannot be renewed. Please upgrade to a paid plan.");
    }

    return this._createPlanInvoice(currentSubscription, currentPlan);
  }

  async activateAfterPayment(invoice, sepayPayload) {
    const plan = await Plan.findById(invoice.planId);
    if (!plan) throw new Error("Plan not found");

    const subscription = await Subscription.findById(invoice.subscriptionId);
    if (!subscription) throw new Error("Subscription not found");

    const oldPlanId = subscription.planId;
    const isRenewal = oldPlanId.toString() === invoice.planId.toString();

    const billingStart = new Date();
    const billingEnd = addDays(billingStart, getBillingDays(plan.billingCycle));

    subscription.planId = plan._id;
    subscription.status = "ACTIVE";
    subscription.startDate = billingStart;
    subscription.endDate = billingEnd;
    subscription.trialEndDate = null;
    subscription.currentQuotaSnapshot = {
      maxBranches: plan.maxBranches,
      maxUsers: plan.maxUsers,
      maxProducts: plan.maxProducts,
    };
    subscription.historyLogs.push({
      event: isRenewal ? "RENEWED" : "UPGRADED",
      fromPlanId: oldPlanId,
      toPlanId: plan._id,
      changedAt: new Date(),
      changedBy: invoice.tenantId,
      note: isRenewal
        ? `Renewed ${plan.planCode} via SePay (ref: ${invoice.paymentReference})`
        : `Upgraded to ${plan.planCode} via SePay (ref: ${invoice.paymentReference})`,
    });

    invoice.status = "PAID";
    invoice.paidAt = new Date();
    invoice.transactionRef =
      sepayPayload.referenceCode ?? String(sepayPayload.id);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await subscription.save({ session });
      await invoice.save({ session });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    return subscription;
  }

  async listPlans() {
    return await Plan.find({ isActive: true })
      .select("-__v")
      .sort({ price: 1 })
      .lean();
  }

  // Admin: every plan, including inactive ones, for the management table.
  async listAllPlans() {
    return await Plan.find({}).select("-__v").sort({ price: 1 }).lean();
  }

  // Admin: partial update. `payload` comes from UpdatePlanDTO.toPayload(),
  // which already excludes planCode/billingCycle (stable keys).
  async updatePlan(planId, payload) {
    const plan = await Plan.findByIdAndUpdate(
      planId,
      { $set: payload },
      { new: true, runValidators: true },
    )
      .select("-__v")
      .lean();

    if (!plan) throw new Error("Plan not found");
    return plan;
  }

  // Admin: soft enable/disable a plan (removes it from the public /plans list).
  async setPlanActive(planId, isActive) {
    const plan = await Plan.findByIdAndUpdate(
      planId,
      { $set: { isActive } },
      { new: true, runValidators: true },
    )
      .select("-__v")
      .lean();

    if (!plan) throw new Error("Plan not found");
    return plan;
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
      currentSubscription.status = "ACTIVE";
      currentSubscription.startDate = new Date();
      currentSubscription.endDate = addDays(
        new Date(),
        getBillingDays(newPlan.billingCycle),
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
        event: "UPGRADED",
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
