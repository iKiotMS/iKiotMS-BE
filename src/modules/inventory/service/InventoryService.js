const { Inventory, ProductItem } = require("../../../models");
const NotificationService = require("../../../services/notificationService");

class InventoryService {
  async getInventories(tenantId, queryParams) {
    const { page, limit, locationId, locationType, isLowStock, search } =
      queryParams;
    const skip = (page - 1) * limit;

    const filter = { tenantId };

    if (locationId && locationType) {
      filter.locationId = locationId;
      filter.locationType = locationType;
    }

    if (isLowStock) {
      // Ngưỡng lấy theo minStock của từng dòng tồn kho, không còn hardcode 10.
      // minStock = 0 nghĩa là tắt cảnh báo cho mặt hàng đó nên loại ra.
      filter.minStock = { $gt: 0 };
      filter.$expr = { $lte: ["$stock", "$minStock"] };
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

  /**
   * Đặt ngưỡng cảnh báo tồn kho thấp cho một dòng tồn kho.
   * Truyền 0 để tắt cảnh báo cho mặt hàng đó tại địa điểm đó.
   *
   * Lọc theo tenantId để một tenant không sửa được tồn kho của tenant khác,
   * kể cả khi đoán đúng _id.
   */
  async updateMinStock(tenantId, inventoryId, minStock) {
    const inventory = await Inventory.findOneAndUpdate(
      { _id: inventoryId, tenantId },
      { $set: { minStock } },
      { new: true, runValidators: true },
    )
      .populate("productItemId", "sku productName")
      .lean();

    if (!inventory) {
      throw new Error("Inventory not found");
    }

    return inventory;
  }

  async initializeStock(tenantId, productItemId, initialStockArray, session) {
    if (!initialStockArray || initialStockArray.length === 0) return;

    const inventoryDocs = initialStockArray.map((item) => ({
      tenantId,
      locationId: item.locationId,
      locationType: item.locationType,
      productItemId: productItemId,
      stock: item.stock || 0,
    }));

    await Inventory.insertMany(inventoryDocs, { session });
  }

  async adjustStock(
    tenantId,
    locationId,
    locationType,
    productItemId,
    amount,
    session,
  ) {
    if (!amount) return null;

    // Trả về document SAU khi cập nhật để bên gọi phát hiện được việc tụt qua
    // ngưỡng (xem lowStockCrossing).
    return Inventory.findOneAndUpdate(
      { tenantId, locationId, locationType, productItemId },
      { $inc: { stock: amount } },
      { upsert: true, new: true, runValidators: true, session },
    );
  }

  /**
   * Phát hiện tồn kho vừa TỤT QUA ngưỡng cảnh báo (edge-trigger).
   *
   * Chỉ báo đúng lúc đi từ TRÊN ngưỡng xuống BẰNG/DƯỚI ngưỡng. Nếu báo mỗi lần
   * stock <= minStock thì mỗi lần bán một món hàng đang thiếu sẽ lại bắn một
   * thông báo — quản lý sẽ tắt noti ngay ngày đầu.
   *
   * @param {object} afterDoc  document Inventory SAU khi trừ
   * @param {number} delta     lượng thay đổi (âm là trừ kho)
   * @returns {object|null}    afterDoc nếu vừa vượt ngưỡng, ngược lại null
   */
  lowStockCrossing(afterDoc, delta) {
    if (!afterDoc || !delta || delta >= 0) return null;

    const minStock = afterDoc.minStock || 0;
    if (minStock <= 0) return null; // 0 = tắt cảnh báo

    const before = afterDoc.stock - delta; // delta âm nên before > stock

    const crossed = before > minStock && afterDoc.stock <= minStock;
    return crossed ? afterDoc : null;
  }

  /**
   * Gửi cảnh báo tồn kho thấp cho quản lý phụ trách đúng địa điểm đó.
   * Gọi SAU khi transaction commit — nếu giao dịch bị rollback thì không được
   * phép để lại một cảnh báo cho thay đổi chưa từng xảy ra.
   */
  async notifyLowStock(crossings = []) {
    // Kho đã trừ và transaction đã commit trước khi hàm này chạy. Một lỗi ở đây
    // (mất kết nối, ProductItem đã bị xoá...) không được phép ném ngược lên làm
    // hỏng việc bán hàng / chuyển kho vốn đã hoàn tất.
    try {
      for (const inventory of crossings.filter(Boolean)) {
        const managers = await NotificationService.managersOfLocation({
          tenantId: inventory.tenantId,
          locationId: inventory.locationId,
          locationType: inventory.locationType,
        });

        const item = await ProductItem.findById(inventory.productItemId)
          .select("sku productName")
          .lean();

        const label = item?.productName || item?.sku || "Một mặt hàng";

        await NotificationService.notify({
          tenantId: inventory.tenantId,
          recipientIds: managers,
          type: "INVENTORY_LOW_STOCK",
          title: "Cảnh báo tồn kho thấp",
          description: `${label} chỉ còn ${inventory.stock} (ngưỡng ${inventory.minStock}). Cân nhắc nhập thêm.`,
          link: "/products",
          referenceId: inventory._id,
        });
      }
    } catch (error) {
      console.error(
        "[InventoryService] Không gửi được cảnh báo tồn kho:",
        error.message,
      );
    }
  }
}

module.exports = new InventoryService();
