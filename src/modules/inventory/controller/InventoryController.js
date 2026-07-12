const InventoryService = require("../service/InventoryService");
const InventoryQueryDTO = require("../dto/InventoryQueryDTO");
const UpdateMinStockDTO = require("../dto/UpdateMinStockDTO");

class InventoryController {
  async getList(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const queryDto = new InventoryQueryDTO(req.query);
      const validation = queryDto.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const result = await InventoryService.getInventories(tenantId, queryDto);

      res.status(200).json({
        success: true,
        message: "Inventories retrieved successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Get inventories error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get inventories",
      });
    }
  }

  async updateMinStock(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const dto = new UpdateMinStockDTO(req.body);
      const validation = dto.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const data = await InventoryService.updateMinStock(
        tenantId,
        id,
        dto.minStock,
      );

      res.status(200).json({
        success: true,
        message: "Cập nhật ngưỡng cảnh báo tồn kho thành công",
        data,
      });
    } catch (error) {
      if (error.message === "Inventory not found") {
        return res.status(404).json({ success: false, message: error.message });
      }

      console.error("Update minStock error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update minimum stock",
      });
    }
  }
}

module.exports = new InventoryController();
