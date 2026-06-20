const ShiftTemplateService = require("../service/ShiftTemplateService");

class ShiftTemplateController {
  async createShiftTemplate(req, res) {
    try {
      const result = await ShiftTemplateService.createShiftTemplate(
        req.user.tenantId,
        req.body,
      );

      return res.status(201).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ message: error.message });
    }
  }

  async getShiftTemplateList(req, res) {
    try {
      const result = await ShiftTemplateService.getShiftTemplateList(
        req.user.tenantId,
        req.query,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ message: error.message });
    }
  }

  async getShiftTemplateById(req, res) {
    try {
      const result = await ShiftTemplateService.getShiftTemplateById(
        req.user.tenantId,
        req.params.shiftTemplateId,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ message: error.message });
    }
  }

  async updateShiftTemplate(req, res) {
    try {
      const result = await ShiftTemplateService.updateShiftTemplate(
        req.user.tenantId,
        req.params.shiftTemplateId,
        req.body,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ message: error.message });
    }
  }

  async deleteShiftTemplate(req, res) {
    try {
      const result = await ShiftTemplateService.deleteShiftTemplate(
        req.user.tenantId,
        req.params.shiftTemplateId,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode || 400)
        .json({ message: error.message });
    }
  }
}

module.exports = new ShiftTemplateController();
