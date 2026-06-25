const { Subscription, Plan } = require("../models");

const subscriptionCache = new Map(); // tenantId → { data, expiresAt }
const TTL = 60 * 1000; // 60 giây

const getSubscriptionCached = async (tenantId) => {
  const cached = subscriptionCache.get(String(tenantId));
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const sub = await Subscription.findOne({ tenantId })
    .populate("planId")
    .lean();

  subscriptionCache.set(String(tenantId), {
    data: sub,
    expiresAt: Date.now() + TTL,
  });

  return sub;
};

const invalidateSubscriptionCache = (tenantId) => {
  subscriptionCache.delete(String(tenantId));
};

const requireActiveSubscription = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const subscription = await getSubscriptionCached(tenantId);

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "No active subscription found",
      });
    }

    const now = new Date();

    // Lazy expiry — trial
    if (subscription.status === "TRIAL" && now > new Date(subscription.trialEndDate)) {
      await Subscription.findByIdAndUpdate(subscription._id, { status: "EXPIRED" });
      invalidateSubscriptionCache(tenantId);
      return res.status(403).json({
        success: false,
        message: "Free trial has expired. Please upgrade your plan to continue.",
      });
    }

    // Lazy expiry — paid plan
    if (subscription.status === "ACTIVE" && now > new Date(subscription.endDate)) {
      await Subscription.findByIdAndUpdate(subscription._id, { status: "EXPIRED" });
      invalidateSubscriptionCache(tenantId);
      return res.status(403).json({
        success: false,
        message: "Subscription has expired. Please renew your plan to continue.",
      });
    }

    if (["EXPIRED", "CANCELLED"].includes(subscription.status)) {
      return res.status(403).json({
        success: false,
        message: `Subscription is ${subscription.status.toLowerCase()}`,
      });
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking subscription",
    });
  }
};

const checkPlanFeature = (featureKey) => (req, res, next) => {
  const features = req.subscription?.planId?.features || [];
  if (!features.includes(featureKey)) {
    return res.status(403).json({
      success: false,
      message: `Your plan does not include: ${featureKey}`,
    });
  }
  next();
};

module.exports = {
  requireActiveSubscription,
  checkPlanFeature,
  invalidateSubscriptionCache,
  getSubscriptionCached,
};
