const StockMovementService = require("../service/StockMovementService");

class StockMovementController {
  async create(req, res) {
    try {
      const { tenantId, userId } = req.user;
      const request = await StockMovementService.create(tenantId, userId, req.body);
      res.status(201).json({
        success: true,
        message: "Stock movement request created successfully",
        data: request,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async updateDetails(req, res) {
    try {
      const { tenantId, userId } = req.user;
      const request = await StockMovementService.updateDetails(tenantId, req.params.id, req.body.details, userId);
      res.status(200).json({
        success: true,
        message: "Details updated successfully",
        data: request,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async open(req, res) {
    try {
      const { tenantId, userId } = req.user;
      const request = await StockMovementService.open(tenantId, req.params.id, userId);
      res.status(200).json({
        success: true,
        message: "Request marked as OPENING",
        data: request,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async close(req, res) {
    try {
      const { tenantId, userId } = req.user;
      const request = await StockMovementService.close(tenantId, req.params.id, userId);
      res.status(200).json({
        success: true,
        message: "Request marked as CLOSED",
        data: request,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async ship(req, res) {
    try {
      const { tenantId, userId } = req.user;
      const request = await StockMovementService.ship(tenantId, req.params.id, userId);
      res.status(200).json({
        success: true,
        message: "Request marked as IN_TRANSIT",
        data: request,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async receive(req, res) {
    try {
      const { tenantId, userId } = req.user;
      const request = await StockMovementService.receive(tenantId, req.params.id, req.body, userId);
      res.status(200).json({
        success: true,
        message: "Inventory updated and request marked as RECEIVED",
        data: request,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async approveAdjust(req, res) {
    try {
      const { tenantId, userId } = req.user;
      const request = await StockMovementService.approveAdjust(tenantId, req.params.id, userId);
      res.status(200).json({
        success: true,
        message: "Adjustment approved and inventory updated",
        data: request,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async cancel(req, res) {
    try {
      const { tenantId, userId } = req.user;
      const request = await StockMovementService.cancel(tenantId, req.params.id, userId);
      res.status(200).json({
        success: true,
        message: "Request cancelled successfully",
        data: request,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getList(req, res) {
    try {
      const { tenantId } = req.user;
      const result = await StockMovementService.getList(tenantId, req.query);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getDetail(req, res) {
    try {
      const { tenantId } = req.user;
      const request = await StockMovementService.getDetail(tenantId, req.params.id);
      res.status(200).json({
        success: true,
        data: request,
      });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  }
}

module.exports = new StockMovementController();
