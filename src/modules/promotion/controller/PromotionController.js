const PromotionService = require("../service/PromotionService");
const CreatePromotionRequestDTO = require("../dto/CreatePromotionRequestDTO");
const UpdatePromotionRequestDTO = require("../dto/UpdatePromotionRequestDTO");
const PromotionQueryDTO = require("../dto/PromotionQueryDTO");
const PromotionCalculateRequestDTO = require("../dto/PromotionCalculateRequestDTO");

class PromotionController {
  async create(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const dto = new CreatePromotionRequestDTO(req.body);
      const validation = dto.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const promotion = await PromotionService.createPromotion(tenantId, dto, req.user);

      res.status(201).json({
        success: true,
        message: "Promotion created successfully",
        data: promotion,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to create promotion",
      });
    }
  }

  async getList(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const queryDTO = new PromotionQueryDTO(req.query);
      const validation = queryDTO.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid query parameters",
          errors: validation.errors,
        });
      }

      const result = await PromotionService.listPromotions(tenantId, req.user, queryDTO);

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to retrieve promotions",
      });
    }
  }

  async getDetail(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const promotion = await PromotionService.getPromotionById(tenantId, id, req.user);

      res.status(200).json({
        success: true,
        data: promotion,
      });
    } catch (error) {
      res.status(error.statusCode || 404).json({
        success: false,
        message: error.message || "Promotion not found",
      });
    }
  }

  async update(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const dto = new UpdatePromotionRequestDTO(req.body);
      const validation = dto.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const promotion = await PromotionService.updatePromotion(tenantId, id, dto, req.user);

      res.status(200).json({
        success: true,
        message: "Promotion updated successfully",
        data: promotion,
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || "Failed to update promotion",
      });
    }
  }

  async softDelete(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const promotion = await PromotionService.softDeletePromotion(tenantId, id);

      res.status(200).json({
        success: true,
        message: "Promotion deactivated successfully",
        data: promotion,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to deactivate promotion",
      });
    }
  }

  async listCandidates(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const dto = new PromotionCalculateRequestDTO(req.body);
      const validation = dto.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const result = await PromotionService.listCandidatePromotions(tenantId, dto);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to list candidate promotions",
      });
    }
  }

  async calculate(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const dto = new PromotionCalculateRequestDTO(req.body);
      const validation = dto.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const result = await PromotionService.calculateDiscount(tenantId, dto);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to calculate promotion discount",
      });
    }
  }

  async apply(req, res) {
    try {
      const tenantId = req.user.tenantId;

      const dto = new PromotionCalculateRequestDTO(req.body);
      const validation = dto.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }
      if (!dto.orderId) {
        return res.status(400).json({
          success: false,
          message: "orderId is required to apply promotions",
        });
      }

      const result = await PromotionService.applyPromotions(tenantId, {
        ...dto,
        userId: req.user.userId,
      });

      res.status(200).json({
        success: true,
        message: "Promotions applied successfully",
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to apply promotions",
      });
    }
  }

  async getLogs(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const queryDTO = new PromotionQueryDTO(req.query);
      const result = await PromotionService.getPromotionLogs(tenantId, id, queryDTO, req.user);

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || "Failed to retrieve promotion logs",
      });
    }
  }
}

module.exports = new PromotionController();
