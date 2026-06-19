const PaySheetService = require("../service/PaySheetService");

class PaySheetController {
  async createPaySheet(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const currentUserId = req.user.userId;
      const data = req.body;

      const result = await PaySheetService.createPaySheet(
        tenantId,
        currentUserId,
        data,
      );
      return res.status(201).json(result);
    } catch (error) {
      return res
        .status(error.statusCode ? error.statusCode : 400)
        .json(error.message);
    }
  }

  async updatePaySheet(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const currentUserId = req.user.userId;
      const data = req.body;
      const paySheetId = req.params.paySheetId;

      const result = await PaySheetService.updatePaySheet(
        paySheetId,
        tenantId,
        currentUserId,
        data,
      );
      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode ? error.statusCode : 400)
        .json(error.message);
    }
  }

  async getPaySheetList(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const currentUserId = req.user.userId;
      const currentUserRole = req.user.role;
      const { page, recordPerPage, ...filters } = req.query;

      const result = await PaySheetService.getPaySheetList(
        tenantId,
        filters,
        page,
        recordPerPage,
        currentUserId,
        currentUserRole,
      );
      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode ? error.statusCode : 400)
        .json(error.message);
    }
  }

  async getPaySheetById(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const paySheetId = req.params.paySheetId;

      const result = await PaySheetService.getPaySheetById(
        paySheetId,
        tenantId,
      );
      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(error.statusCode ? error.statusCode : 400)
        .json(error.message);
    }
  }
}

module.exports = new PaySheetController();
