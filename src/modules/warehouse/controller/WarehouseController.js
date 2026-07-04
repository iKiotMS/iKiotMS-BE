const WarehouseService = require("../service/WarehouseService");
const CreateWarehouseRequestDTO = require("../dto/CreateWarehouseRequestDTO");
const UpdateWarehouseRequestDTO = require("../dto/UpdateWarehouseRequestDTO");
const WarehouseQueryDTO = require("../dto/WarehouseQueryDTO");
const AssignWarehouseManagerDTO = require("../dto/AssignWarehouseManagerDTO");
const { deleteByPattern, deleteKeys, cacheKeys } = require("../../../utils/cacheHelpers");

class WarehouseController {
  async create(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const dto = new CreateWarehouseRequestDTO(req.body);
      const validation = dto.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const warehouse = await WarehouseService.createWarehouse(tenantId, dto);

      deleteByPattern(`warehouses:list:${tenantId}:*`).catch(() => {});

      res.status(201).json({
        success: true,
        message: "Warehouse created successfully",
        data: warehouse,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create warehouse",
      });
    }
  }

  async getList(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const queryDto = new WarehouseQueryDTO(req.query);
      const validation = queryDto.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const result = await WarehouseService.getWarehouses(tenantId, queryDto);

      res.status(200).json({
        success: true,
        message: "Warehouses retrieved successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Get warehouses error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get warehouses",
      });
    }
  }

  async getById(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const warehouse = await WarehouseService.getWarehouseById(tenantId, id);

      res.status(200).json({
        success: true,
        message: "Warehouse retrieved successfully",
        data: warehouse,
      });
    } catch (error) {
      console.error("Get warehouse error:", error);
      res.status(error.message === "Warehouse not found" ? 404 : 500).json({
        success: false,
        message: error.message || "Failed to get warehouse",
      });
    }
  }

  async update(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;
      const dto = new UpdateWarehouseRequestDTO(req.body);
      const validation = dto.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const warehouse = await WarehouseService.updateWarehouse(tenantId, id, dto);

      deleteByPattern(`warehouses:list:${tenantId}:*`).catch(() => {});
      deleteKeys(cacheKeys.warehouseDetail(tenantId, id)).catch(() => {});

      res.status(200).json({
        success: true,
        message: "Warehouse updated successfully",
        data: warehouse,
      });
    } catch (error) {
      console.error("Update warehouse error:", error);
      res.status(error.message === "Warehouse not found" ? 404 : 400).json({
        success: false,
        message: error.message || "Failed to update warehouse",
      });
    }
  }

  async softDelete(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const warehouse = await WarehouseService.softDeleteWarehouse(tenantId, id);

      deleteByPattern(`warehouses:list:${tenantId}:*`).catch(() => {});
      deleteKeys(cacheKeys.warehouseDetail(tenantId, id)).catch(() => {});

      res.status(200).json({
        success: true,
        message: "Warehouse deleted successfully",
        data: warehouse,
      });
    } catch (error) {
      console.error("Delete warehouse error:", error);
      res.status(error.message === "Warehouse not found" ? 404 : 400).json({
        success: false,
        message: error.message || "Failed to delete warehouse",
      });
    }
  }

  async assignManager(req, res) {
    try {
      if (req.user.role !== "TENANT_OWNER") {
        return res.status(403).json({
          success: false,
          message: "Only tenant owner can change warehouse manager",
        });
      }

      const tenantId = req.user.tenantId;
      const { id } = req.params;
      const dto = new AssignWarehouseManagerDTO(req.body);
      const validation = dto.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const result = await WarehouseService.assignWarehouseManager({
        tenantId,
        warehouseId: id,
        staffId: dto.staffId,
      });

      deleteByPattern(`warehouses:list:${tenantId}:*`).catch(() => {});
      deleteKeys(cacheKeys.warehouseDetail(tenantId, id)).catch(() => {});

      res.status(200).json({
        success: true,
        message: "Warehouse manager updated successfully",
        data: result,
      });
    } catch (error) {
      res.status(error.message === "Warehouse not found" ? 404 : 400).json({
        success: false,
        message: error.message || "Failed to update warehouse manager",
      });
    }
  }
}

module.exports = new WarehouseController();
