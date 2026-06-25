const SubscriptionService = require("../service/SubscriptionService");
const {
  Plan,
  SubscriptionInvoice,
  Order,
  CashFlow,
} = require("../../../models");
const sepayService = require("../../../services/sepayService");
const { emitToRoom } = require("../../../services/socketService");

class SubscriptionController {
  async assignFreeTrial(req, res) {
    try {
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;

      const existingSubscription =
        await SubscriptionService.getSubscriptionByTenantId(tenantId);

      if (existingSubscription) {
        return res.status(400).json({
          success: false,
          message: "Tenant already has a subscription",
        });
      }

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

      const subscription =
        await SubscriptionService.createSubscriptionForExistingTenant(
          tenantId,
          userId,
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
      res.status(200).json({ success: true, data: trialStatus });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to check trial status",
      });
    }
  }

  async upgradePlan(req, res) {
    try {
      const tenantId = req.params.tenantId;
      const { userId, role } = req.user;
      const { planCode } = req.body;

      if (role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only super admins can upgrade the plan",
        });
      }

      if (!planCode) {
        return res
          .status(400)
          .json({ success: false, message: "planCode is required" });
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

  async getInvoiceStatus(req, res) {
    try {
      const { invoiceId } = req.params;
      const invoice = await SubscriptionInvoice.findOne({
        _id: invoiceId,
        tenantId: req.user.tenantId,
      }).lean();

      if (!invoice) {
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found" });
      }

      res.status(200).json({
        success: true,
        data: { status: invoice.status, paidAt: invoice.paidAt },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Called by SePay when money arrives in iKiot's bank account (subscription payment)
  async handleSepayWebhook(req, res) {
    try {
      const payload = req.body;
      const header =
        req.headers["authorization"] || req.headers["Authorization"] || "";

      if (!sepayService.verifyWebhookKey(header.split(" ")[1] ?? "")) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid API key" });
      }

      if (payload.transferType !== "in") {
        return res.status(200).json({ success: true });
      }

      const paymentReference = sepayService.extractReference(
        payload.content ?? "",
      );
      if (!paymentReference) {
        return res
          .status(200)
          .json({ success: true, message: "No matching reference found" });
      }

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

      if (payload.transferAmount < invoice.amount) {
        console.warn(
          `SePay: underpaid invoice ${invoice._id}. Expected ${invoice.amount}, got ${payload.transferAmount}`,
        );
        return res
          .status(200)
          .json({ success: true, message: "Underpaid — ignored" });
      }

      const subscription = await SubscriptionService.activateAfterPayment(
        invoice,
        payload,
      );

      // Notify FE: room = "tenant:<tenantId>"
      emitToRoom(`tenant:${invoice.tenantId}`, "subscription:activated", {
        invoiceId: invoice._id,
        planId: subscription.planId,
        status: subscription.status,
        endDate: subscription.endDate,
      });

      res
        .status(200)
        .json({ success: true, message: "Subscription activated" });
    } catch (error) {
      console.error("SePay webhook error:", error);
      res.status(200).json({ success: false, message: error.message });
    }
  }

  // Called by SePay when money arrives in a tenant's bank account (order payment)
  async handleSepayOrderWebhook(req, res) {
    try {
      const payload = req.body;

      if (payload.transferType !== "in") {
        return res.status(200).json({ success: true });
      }

      const tenant = await sepayService.findTenantByWebhookKey(payload.apiKey);
      if (!tenant) {
        return res
          .status(200)
          .json({ success: true, message: "Unknown API key" });
      }

      const paymentReference = sepayService.extractOrderRef(
        payload.content ?? "",
      );
      if (!paymentReference) {
        return res
          .status(200)
          .json({ success: true, message: "No order reference found" });
      }

      const order = await Order.findOne({
        paymentReference,
        status: "PENDING",
        paymentMethod: "SEPAY",
        tenantId: tenant._id,
      });

      if (!order) {
        return res
          .status(200)
          .json({ success: true, message: "Order not found or already paid" });
      }

      if (payload.transferAmount < order.grandTotal) {
        console.warn(
          `SePay order: underpaid order ${order._id}. Expected ${order.grandTotal}, got ${payload.transferAmount}`,
        );
        return res
          .status(200)
          .json({ success: true, message: "Underpaid — ignored" });
      }

      order.status = "COMPLETED";
      order.sepayTransactionId = payload.id;
      await order.save();

      await CashFlow.create({
        tenantId: order.tenantId,
        branchId: order.branchId,
        orderId: order._id,
        flowType: "INCOME",
        amount: payload.transferAmount,
        paymentMethod: "SEPAY",
        description: `SePay - ${order.paymentReference}`,
      });

      // Notify FE: room = "order:<orderId>"
      emitToRoom(`order:${order._id}`, "order:paid", {
        orderId: order._id,
        status: order.status,
        paidAmount: payload.transferAmount,
      });

      res
        .status(200)
        .json({ success: true, message: "Order payment confirmed" });
    } catch (error) {
      console.error("SePay order webhook error:", error);
      res.status(200).json({ success: false, message: error.message });
    }
  }
}

module.exports = new SubscriptionController();
