const { Inventory, ProductItem } = require("../../../models");

class InventoryService {
  async getInventories(tenantId, queryParams) {
    const { page, limit, locationId, locationType, isLowStock, search } = queryParams;
    const skip = (page - 1) * limit;

    const filter = { tenantId };

    if (locationId && locationType) {
      filter.locationId = locationId;
      filter.locationType = locationType;
    }

    if (isLowStock) {
      // Define low stock threshold (e.g., 10)
      filter.stock = { $lte: 10 };
    }

    // Handle search by product name or SKU
    if (search) {
      // Find matching ProductItems first
      const matchingProductItems = await ProductItem.find({
        tenantId,
        $or: [
          { sku: { $regex: search, $options: "i" } },
          { productName: { $regex: search, $options: "i" } },
        ],
      }).lean();

      const productItemIds = matchingProductItems.map((item) => item._id);
      filter.productItemId = { $in: productItemIds };
    }

    const [data, total] = await Promise.all([
      Inventory.find(filter)
        .populate("productItemId", "sku productName attributes images")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Inventory.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = new InventoryService();
