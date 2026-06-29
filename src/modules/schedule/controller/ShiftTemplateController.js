const ShiftTemplateService = require("../service/ShiftTemplateService");
const { deleteByPattern, deleteKeys, cacheKeys } = require("../../../utils/cacheHelpers");

class ShiftTemplateController {
  getRequestData(req) {
    return req.body?.data || req.body || {};
  }

  async createShiftTemplate(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const data = this.getRequestData(req);

      const result = await ShiftTemplateService.createShiftTemplate(
        tenantId,
        data,
      );

      deleteByPattern(`shift-templates:list:${tenantId}:*`).catch(() => {});

      return res.status(201).json(result);
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getShiftTemplateList(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const result = await ShiftTemplateService.getShiftTemplateList(
        tenantId,
        req.query,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getShiftTemplateById(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const shiftTemplateId = req.params.shiftTemplateId;

      const result = await ShiftTemplateService.getShiftTemplateById(
        tenantId,
        shiftTemplateId,
      );

      return res.status(200).json(result);
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateShiftTemplate(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const shiftTemplateId = req.params.shiftTemplateId;
      const data = this.getRequestData(req);

      const result = await ShiftTemplateService.updateShiftTemplate(
        tenantId,
        shiftTemplateId,
        data,
      );

      deleteByPattern(`shift-templates:list:${tenantId}:*`).catch(() => {});
      deleteKeys(
        cacheKeys.shiftTemplateDetail(tenantId, shiftTemplateId),
      ).catch(() => {});

      return res.status(200).json(result);
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteShiftTemplate(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const shiftTemplateId = req.params.shiftTemplateId;

      const result = await ShiftTemplateService.deleteShiftTemplate(
        tenantId,
        shiftTemplateId,
      );

      deleteByPattern(`shift-templates:list:${tenantId}:*`).catch(() => {});
      deleteKeys(
        cacheKeys.shiftTemplateDetail(tenantId, shiftTemplateId),
      ).catch(() => {});

      return res.status(200).json(result);
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new ShiftTemplateController();
