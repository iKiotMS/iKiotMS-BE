const SupplierService = require("../service/SupplierService");
const sepayService = require("../../../services/sepayService");

class SupplierController {
  async create(req, res) {
    try {
      const { tenantId } = req.user;
      const supplier = await SupplierService.create(tenantId, req.body);
      res.status(201).json({
        success: true,
        message: "Supplier created successfully",
        data: supplier,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getList(req, res) {
    try {
      const { tenantId } = req.user;
      const result = await SupplierService.getList(tenantId, req.query);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getDetail(req, res) {
    try {
      const { tenantId } = req.user;
      const supplier = await SupplierService.getDetail(tenantId, req.params.id);
      res.status(200).json({
        success: true,
        data: supplier,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  async update(req, res) {
    try {
      const { tenantId } = req.user;
      const supplier = await SupplierService.update(tenantId, req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: "Supplier updated successfully",
        data: supplier,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async delete(req, res) {
    try {
      const { tenantId } = req.user;
      await SupplierService.delete(tenantId, req.params.id);
      res.status(200).json({
        success: true,
        message: "Supplier deleted successfully",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async initiateQr(req, res) {
    try {
      const { tenantId, userId } = req.user;
      const { amount, note } = req.body;
      if (!amount) {
        return res.status(400).json({ success: false, message: "amount is required" });
      }
      const result = await SupplierService.initiateQr(
        tenantId,
        req.params.id,
        Number(amount),
        userId,
        note,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Called by SePay when money arrives and content contains a SUP-prefixed reference
  async handleSepaySupplierWebhook(req, res) {
    try {
      const payload = req.body;

      if (payload.transferType !== "in") {
        return res.status(200).json({ success: true });
      }

      const authHeader = req.headers["authorization"] || req.headers["Authorization"] || "";
      const apiKey = authHeader.startsWith("Apikey ") ? authHeader.slice(7).trim() : null;

      const tenant = await sepayService.findTenantByWebhookKey(apiKey);
      if (!tenant) {
        return res.status(200).json({ success: false, message: "Unknown API key" });
      }

      const paymentReference = sepayService.extractSupplierRef(payload.content ?? "");
      if (!paymentReference) {
        return res.status(200).json({ success: false, message: "No supplier reference found" });
      }

      const supplier = await SupplierService.completeDebtPayment(
        tenant._id,
        paymentReference,
        payload.transferAmount,
      );

      if (!supplier) {
        return res.status(200).json({ success: false, message: "Intent not found or already processed" });
      }

      res.status(200).json({ success: true, message: "Supplier debt payment confirmed" });
    } catch (error) {
      console.error("SePay supplier webhook error:", error);
      res.status(200).json({ success: false, message: error.message });
    }
  }

  async payDebt(req, res) {
    try {
      const result = await SupplierService.payDebt(req.user, req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: "Debt payment recorded successfully",
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new SupplierController();
