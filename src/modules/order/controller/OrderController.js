const OrderService = require("../service/OrderService");
const CreateOrderDTO = require("../dto/CreateOrderDTO");
const UpdateOrderStatusDTO = require("../dto/UpdateOrderStatusDTO");
const OrderQueryDTO = require("../dto/OrderQueryDTO");
const sepayService = require("../../../services/sepayService");

class OrderController {
  async create(req, res) {
    try {
      const { tenantId, userId } = req.user;
      const dto = new CreateOrderDTO(req.body);
      const { isValid, errors } = dto.validate();
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Validation failed", errors });
      }

      const { order, qrUrl } = await OrderService.createOrder(tenantId, userId, dto);
      res.status(201).json({
        success: true,
        message: "Order created",
        data: { order, ...(qrUrl && { qrUrl }) },
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getList(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const dto = new OrderQueryDTO(req.query);
      const { isValid, errors } = dto.validate();
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Validation failed", errors });
      }

      const result = await OrderService.getOrders(tenantId, dto);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getDetail(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const order = await OrderService.getOrderById(tenantId, req.params.id);
      res.status(200).json({ success: true, data: order });
    } catch (error) {
      const status = error.message === "Order not found" ? 404 : 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const dto = new UpdateOrderStatusDTO(req.body);
      const { isValid, errors } = dto.validate();
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Validation failed", errors });
      }

      const order = await OrderService.updateOrderStatus(tenantId, req.params.id, dto.status);
      res.status(200).json({ success: true, message: "Order status updated", data: order });
    } catch (error) {
      const status = error.message === "Order not found" ? 404 : 400;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async handleSepayOrderWebhook(req, res) {
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

      const paymentReference = sepayService.extractOrderRef(payload.content ?? "");
      if (!paymentReference) {
        return res.status(200).json({ success: false, message: "No order reference found" });
      }

      const order = await OrderService.completeSepayOrder(
        tenant._id,
        paymentReference,
        payload.id,
        payload.transferAmount,
      );

      if (!order) {
        return res
          .status(200)
          .json({ success: false, message: "Order not found or already processed" });
      }

      res.status(200).json({ success: true, message: "Order payment confirmed" });
    } catch (error) {
      console.error("SePay order webhook error:", error);
      // Always return 200 so SePay does not retry indefinitely
      res.status(200).json({ success: false, message: error.message });
    }
  }
}

module.exports = new OrderController();
