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

  async generatePayrollPeriod(req, res) {
    try {
      const result = await PayrollService.generatePayrollPeriod({
        tenantId: req.user.tenantId,
        currentUserId: req.user.userId,
        payrollData: req.body,
      });

      return res.status(201).json({ success: true, ...result });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Không thể tạo kỳ lương",
        ...(error.errors && { errors: error.errors }),
        ...(error.skipped && { skipped: error.skipped }),
        ...(error.conflictingPayrollPeriodId && {
          conflictingPayrollPeriodId: error.conflictingPayrollPeriodId,
        }),
      });
    }
  }

  async listPayrollPeriods(req, res) {
    try {
      const result = await PayrollService.listPayrollPeriods({
        tenantId: req.user.tenantId,
        query: req.query,
      });
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return this.sendError(res, error, "Không thể lấy danh sách kỳ lương");
    }
  }

  async getPayrollPeriod(req, res) {
    try {
      const data = await PayrollService.getPayrollPeriod({
        tenantId: req.user.tenantId,
        periodId: req.params.periodId,
        query: req.query,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return this.sendError(res, error, "Không thể lấy kỳ lương");
    }
  }

  async getPayslip(req, res) {
    try {
      const data = await PayrollService.getPayslip({
        tenantId: req.user.tenantId,
        periodId: req.params.periodId,
        payslipId: req.params.payslipId,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return this.sendError(res, error, "Không thể lấy phiếu lương");
    }
  }

  async updateDraftPayslip(req, res) {
    try {
      const data = await PayrollService.updateDraftPayslip({
        tenantId: req.user.tenantId,
        currentUserId: req.user.userId,
        periodId: req.params.periodId,
        payslipId: req.params.payslipId,
        updateData: req.body,
      });
      return res.status(200).json({
        success: true,
        message: "Cập nhật phiếu lương nháp thành công",
        data,
      });
    } catch (error) {
      return this.sendError(res, error, "Không thể cập nhật phiếu lương");
    }
  }

  async listMyPayslips(req, res) {
    try {
      const result = await PayrollService.listMyPayslips({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        query: req.query,
      });
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return this.sendError(res, error, "Không thể lấy phiếu lương của tôi");
    }
  }

  async getMyPayslip(req, res) {
    try {
      const data = await PayrollService.getMyPayslip({
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        payslipId: req.params.payslipId,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return this.sendError(res, error, "Không thể lấy phiếu lương của tôi");
    }
  }

  async payrollPeriodAction(req, res, action, message) {
    try {
      const data = await PayrollService.changePayrollPeriodStatus({
        tenantId: req.user.tenantId,
        currentUserId: req.user.userId,
        periodId: req.params.periodId,
        action,
        actionData: req.body,
      });
      return res.status(200).json({ success: true, message, data });
    } catch (error) {
      return this.sendError(res, error, "Không thể chuyển trạng thái kỳ lương");
    }
  }

  sendError(res, error, fallbackMessage) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || fallbackMessage,
      ...(error.errors && { errors: error.errors }),
    });
  }
}

module.exports = new PayrollController();
