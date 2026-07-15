const CashDrawerService = require("../service/CashDrawerService");
const OpenCashDrawerDTO = require("../dto/OpenCashDrawerDTO");
const ShiftLogDTO = require("../dto/ShiftLogDTO");
const FinalizeCashDrawerDTO = require("../dto/FinalizeCashDrawerDTO");
const CashDrawerQueryDTO = require("../dto/CashDrawerQueryDTO");

class CashDrawerController {
  actor(req) {
    return {
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      role: req.user.role,
      branchId: req.user.branchId,
    };
  }

  validate(dto) {
    const validation = dto.validate();
    if (!validation.isValid) {
      const error = new Error("Validation failed");
      error.statusCode = 400;
      error.errors = validation.errors;
      throw error;
    }
  }

  async open(req, res) {
    try {
      const dto = new OpenCashDrawerDTO(req.body);
      this.validate(dto);
      const data = await CashDrawerService.open({ actor: this.actor(req), dto });
      return res.status(201).json({
        success: true,
        message: "Cash drawer opened",
        data,
      });
    } catch (error) {
      return this.sendError(res, error);
    }
  }

  async current(req, res) {
    try {
      const data = await CashDrawerService.current({
        actor: this.actor(req),
        branchId: req.query.branchId,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return this.sendError(res, error);
    }
  }

  async list(req, res) {
    try {
      const dto = new CashDrawerQueryDTO(req.query);
      this.validate(dto);
      const result = await CashDrawerService.list({ actor: this.actor(req), dto });
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return this.sendError(res, error);
    }
  }

  async detail(req, res) {
    try {
      const data = await CashDrawerService.detail({
        actor: this.actor(req),
        sessionId: req.params.id,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return this.sendError(res, error);
    }
  }

  async createShiftLog(req, res) {
    try {
      const dto = new ShiftLogDTO(req.body);
      this.validate(dto);
      const data = await CashDrawerService.submitShiftLog({
        actor: this.actor(req),
        sessionId: req.params.id,
        dto,
      });
      return res.status(201).json({
        success: true,
        message: "Shift log recorded",
        data,
      });
    } catch (error) {
      return this.sendError(res, error);
    }
  }

  async finalize(req, res) {
    try {
      const dto = new FinalizeCashDrawerDTO(req.body);
      this.validate(dto);
      const data = await CashDrawerService.finalize({
        actor: this.actor(req),
        sessionId: req.params.id,
        dto,
      });
      return res.status(200).json({
        success: true,
        message: "Cash drawer finalized",
        data,
      });
    } catch (error) {
      return this.sendError(res, error);
    }
  }

  sendError(res, error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Cash drawer operation failed",
      ...(error.errors && { errors: error.errors }),
    });
  }
}

module.exports = new CashDrawerController();
