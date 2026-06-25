const SubscriptionService = require("../service/SubscriptionService");
const {
  Plan,
  SubscriptionInvoice,
} = require("../../../models");
const sepayService = require("../../../services/sepayService");

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

  async upgradePlan(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;
      const { planCode } = req.body;

      if (!planCode) {
        return res.status(400).json({
          success: false,
          message: "planCode is required",
        });
      }

      const result = await SubscriptionService.upgradePlan(
        tenantId,
        userId,
        planCode,
      );

      res.status(200).json({
        success: true,
        message: `Successfully upgraded to ${planCode}`,
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to upgrade plan",
      });
    }
  }

  async initiateUpgrade(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;
      const { planCode } = req.body;

      if (!planCode) {
        return res
          .status(400)
          .json({ success: false, message: "planCode is required" });
      }

      const result = await SubscriptionService.initiateUpgrade(
        tenantId,
        userId,
        planCode,
      );

      res.status(200).json({
        success: true,
        message:
          "Payment initiated. Scan QR or transfer with the reference code.",
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to initiate upgrade",
      });
    }
  }

  async handleSepayWebhook(req, res) {
    try {
      const payload = req.body;
      const header =
        req.headers["authorization"] || req.headers["Authorization"] || "";

      // Verify SePay API key
      if (!sepayService.verifyWebhookKey(header.split(" ")[1] ?? "")) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid API key" });
      }

      // Only process incoming transfers
      if (payload.transferType !== "in") {
        return res.status(200).json({ success: true });
      }

      // Extract our reference code from transfer content
      const paymentReference = sepayService.extractReference(
        payload.content ?? "",
      );
      if (!paymentReference) {
        return res
          .status(200)
          .json({ success: true, message: "No matching reference found" });
      }

      // Find pending invoice
      const invoice = await SubscriptionInvoice.findOne({
        paymentReference,
        status: "PENDING",
      });

      if (!invoice) {
        return res.status(200).json({
          success: true,
          message: "Invoice not found or already processed",
        });
      }

      // Verify amount
      if (payload.transferAmount < invoice.amount) {
        console.warn(
          `SePay: underpaid for invoice ${invoice._id}. Expected ${invoice.amount}, got ${payload.transferAmount}`,
        );
        return res
          .status(200)
          .json({ success: true, message: "Underpaid — ignored" });
      }

      await SubscriptionService.activateAfterPayment(invoice, payload);

      res
        .status(200)
        .json({ success: true, message: "Subscription activated" });
    } catch (error) {
      console.error("SePay webhook error:", error);
      // Always return 200 so SePay does not retry indefinitely
      res.status(200).json({ success: false, message: error.message });
    }
  }

}


module.exports = new SubscriptionController();
