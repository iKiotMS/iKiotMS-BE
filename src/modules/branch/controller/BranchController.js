const BranchService = require("../service/BranchService");
const CreateBranchRequestDTO = require("../dto/CreateBranchRequestDTO");
const UpdateBranchRequestDTO = require("../dto/UpdateBranchRequestDTO");
const BranchQueryDTO = require("../dto/BranchQueryDTO");
const { deleteByPattern, deleteKeys, cacheKeys } = require("../../../utils/cacheHelpers");

class BranchController {
  async create(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const subscription = req.subscription;
      const dto = new CreateBranchRequestDTO(req.body);
      const validation = dto.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const branch = await BranchService.createBranch(
        tenantId,
        dto,
        subscription,
      );

      deleteByPattern(`branches:list:${tenantId}:*`).catch(() => {});

      res.status(201).json({
        success: true,
        message: "Branch created successfully",
        data: branch,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to create branch",
      });
    }
  }

  async getList(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const queryDto = new BranchQueryDTO(req.query);
      const validation = queryDto.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const result = await BranchService.getBranches(tenantId, queryDto);

      res.status(200).json({
        success: true,
        message: "Branches retrieved successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Get branches error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get branches",
      });
    }
  }

  async getById(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const branch = await BranchService.getBranchById(tenantId, id);

      res.status(200).json({
        success: true,
        message: "Branch retrieved successfully",
        data: branch,
      });
    } catch (error) {
      console.error("Get branch error:", error);
      res.status(error.message === "Branch not found" ? 404 : 500).json({
        success: false,
        message: error.message || "Failed to get branch",
      });
    }
  }

  async update(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;
      const dto = new UpdateBranchRequestDTO(req.body);
      const validation = dto.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const branch = await BranchService.updateBranch(tenantId, id, dto);

      deleteByPattern(`branches:list:${tenantId}:*`).catch(() => {});
      deleteKeys(cacheKeys.branchDetail(tenantId, id)).catch(() => {});

      res.status(200).json({
        success: true,
        message: "Branch updated successfully",
        data: branch,
      });
    } catch (error) {
      console.error("Update branch error:", error);
      res.status(error.message === "Branch not found" ? 404 : 400).json({
        success: false,
        message: error.message || "Failed to update branch",
      });
    }
  }

  async softDelete(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const branch = await BranchService.softDeleteBranch(tenantId, id);

      deleteByPattern(`branches:list:${tenantId}:*`).catch(() => {});
      deleteKeys(cacheKeys.branchDetail(tenantId, id)).catch(() => {});

      res.status(200).json({
        success: true,
        message: "Branch deleted successfully",
        data: branch,
      });
    } catch (error) {
      console.error("Delete branch error:", error);
      res.status(error.message === "Branch not found" ? 404 : 400).json({
        success: false,
        message: error.message || "Failed to delete branch",
      });
    }
  }
}

module.exports = new BranchController();
