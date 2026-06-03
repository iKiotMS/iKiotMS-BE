const SubscriptionService = require("../service/SubscriptionService");
const { Plan } = require("../../../models");

class SubscriptionController {
  async assignFreeTrial(req, res) {
    try {
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;

      // Check if user already has a subscription
      const existingSubscription =
        await SubscriptionService.getSubscriptionByTenantId(tenantId);

      if (existingSubscription) {
        return res.status(400).json({
          success: false,
          message: "Tenant already has a subscription",
        });
      }

      // Find the free trial plan
      const plan = await Plan.findOne({
        planCode: "FREE_TRIAL",
        isActive: true,
      });

      if (!plan) {
        return res.status(400).json({
          success: false,
          message: "Free trial plan not available",
        });
      }

      // Calculate trial dates
      const startDate = new Date();
      const trialEndDate = new Date(
        startDate.getTime() + plan.trialDays * 24 * 60 * 60 * 1000,
      );
      const endDate = new Date(trialEndDate); // For trial, end date equals trial end date

      // Create subscription
      const subscription =
        await SubscriptionService.createSubscriptionForExistingTenant(
          tenantId,
          req.user.userId,
        );

      res.status(200).json({
        success: true,
        message: "Free trial assigned successfully",
        data: {
          subscription: {
            id: subscription._id,
            status: subscription.status,
            trialEndDate: subscription.trialEndDate,
            plan: {
              id: plan._id,
              planName: plan.planName,
              planCode: plan.planCode,
              trialDays: plan.trialDays,
            },
          },
        },
      });
    } catch (error) {
      console.error("Free trial assignment error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to assign free trial",
      });
    }
  }

  async checkTrialStatus(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const trialStatus = await SubscriptionService.checkTrialStatus(tenantId);

      res.status(200).json({
        success: true,
        data: trialStatus,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to check trial status",
      });
    }
  }
}

module.exports = new SubscriptionController();
