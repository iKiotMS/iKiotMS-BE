const PayrollSettingService = require("../service/PayrollSettingService");

class PayrollSettingController {
  async getPayrollSetting(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const result = await PayrollSettingService.getPayrollSetting(tenantId);
      res.status(result.statusCode).json(result.data);
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
        ...(error.errors && { errors: error.errors }),
      });
    }
  }

  async createPayrollSetting(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const data = req.body;
      const result = await PayrollSettingService.createPayrollSetting({
        tenantId,
        payrollSettingData: data,
      });
      return res
        .status(result.statusCode)
        .json({ message: result.message, data: result.data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
        ...(error.errors && { errors: error.errors }),
      });
    }
  }

  async updatePayrollSetting(req, res) {
    try {
        const tenantId = req.user.tenantId;
        const data = req.body;
        const result = await PayrollSettingService.updatePayrollSetting({
          tenantId,
          payrollSettingData: data,
        });
        return res
          .status(result.statusCode)
          .json({ message: result.message, data: result.data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
        ...(error.errors && { errors: error.errors }),
      });
    }
  }
}
module.exports = new PayrollSettingController();
