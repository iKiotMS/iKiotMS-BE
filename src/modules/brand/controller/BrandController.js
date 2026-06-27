const BrandService = require("../service/BrandService");

class BrandController {
  async create(req, res) {
    try {
      const brand = await BrandService.create(req.body);
      res.status(201).json({
        success: true,
        message: "Brand created successfully",
        data: brand,
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
      const result = await BrandService.getList(req.query);
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
      const brand = await BrandService.getDetail(req.params.id);
      res.status(200).json({
        success: true,
        data: brand,
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
      const brand = await BrandService.update(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: "Brand updated successfully",
        data: brand,
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
      await BrandService.delete(req.params.id);
      res.status(200).json({
        success: true,
        message: "Brand deleted successfully",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new BrandController();
