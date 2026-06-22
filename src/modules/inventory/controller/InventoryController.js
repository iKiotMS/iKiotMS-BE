const InventoryService = require("../service/InventoryService");
const InventoryQueryDTO = require("../dto/InventoryQueryDTO");

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
}

module.exports = new InventoryController();
