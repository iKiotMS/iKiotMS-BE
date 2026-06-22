const WarehouseService = require("../service/WarehouseService");
const CreateWarehouseRequestDTO = require("../dto/CreateWarehouseRequestDTO");
const UpdateWarehouseRequestDTO = require("../dto/UpdateWarehouseRequestDTO");
const WarehouseQueryDTO = require("../dto/WarehouseQueryDTO");

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

      res.status(201).json({
        success: true,
        message: "Warehouse created successfully",
        data: warehouse,
      });
    } catch (error) {
      console.error("Create warehouse error:", error);
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
}

module.exports = new WarehouseController();
