const SupplierService = require("../service/SupplierService");

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
