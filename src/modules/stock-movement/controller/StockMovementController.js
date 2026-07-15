const StockMovementService = require("../service/StockMovementService");

class StockMovementController {
  async create(req, res) {
    try {
      const request = await StockMovementService.create(req.user, req.body);
      res.status(201).json({
        success: true,
        message: "Stock movement request created successfully",
        data: request,
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  async updateDetails(req, res) {
    try {
      const request = await StockMovementService.updateDetails(req.user, req.params.id, req.body.details);
      res.status(200).json({
        success: true,
        message: "Details updated successfully",
        data: request,
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  async open(req, res) {
    try {
      const request = await StockMovementService.open(req.user, req.params.id);
      res.status(200).json({
        success: true,
        message: "Request marked as OPENING",
        data: request,
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  async close(req, res) {
    try {
      const request = await StockMovementService.close(req.user, req.params.id);
      res.status(200).json({
        success: true,
        message: "Request marked as CLOSED",
        data: request,
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  async ship(req, res) {
    try {
      const request = await StockMovementService.ship(req.user, req.params.id);
      res.status(200).json({
        success: true,
        message: "Request marked as IN_TRANSIT",
        data: request,
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  async receive(req, res) {
    try {
      const request = await StockMovementService.receive(req.user, req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: "Inventory updated and request marked as RECEIVED",
        data: request,
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  async approveAdjust(req, res) {
    try {
      const request = await StockMovementService.approveAdjust(req.user, req.params.id);
      res.status(200).json({
        success: true,
        message: "Adjustment approved and inventory updated",
        data: request,
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  async cancel(req, res) {
    try {
      const request = await StockMovementService.cancel(req.user, req.params.id);
      res.status(200).json({
        success: true,
        message: "Request cancelled successfully",
        data: request,
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  async getList(req, res) {
    try {
      const result = await StockMovementService.getList(req.user, req.query);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  async getDetail(req, res) {
    try {
      const request = await StockMovementService.getDetail(req.user, req.params.id);
      res.status(200).json({
        success: true,
        data: request,
      });
    } catch (error) {
      res.status(error.statusCode || 404).json({ success: false, message: error.message });
    }
  }
}

module.exports = new StockMovementController();
