const PayrollService = require("../service/PayrollService");

class PayrollController {
  async generatePreview(req, res) {
    try {
      const result = await PayrollService.generatePayRoll({
        tenantId: req.user.tenantId,
        currentUserId: req.user.userId,
        payrollData: req.body,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Không thể tính bảng lương nháp",
        ...(error.errors && { errors: error.errors }),
      });
    }
  }
}

module.exports = new PayrollController();
