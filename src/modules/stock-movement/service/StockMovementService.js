const mongoose = require("mongoose");
const { StockMovementRequest, Supplier, Branch, Warehouse } = require("../../../models");
const InventoryService = require("../../inventory/service/InventoryService");
const NotificationService = require("../../../services/notificationService");

class StockMovementService {
  /**
   * Gửi thông báo cho các bên liên quan tới một phiếu chuyển kho.
   *
   * Gọi SAU khi transaction đã commit — thông báo là kênh phụ, không được phép
   * làm hỏng việc xuất/nhập kho. Người thực hiện hành động luôn bị loại khỏi
   * danh sách nhận: không ai cần được báo về việc mình vừa làm.
   *
   * audience: "managers" (mặc định) báo quản lý địa điểm nhận, "creator" báo
   * người tạo phiếu, "both" báo cả hai trong MỘT lần gửi — notify() tự dedupe
   * nên người vừa là quản lý vừa là người tạo cũng chỉ nhận một thông báo.
   */
  async _notifyMovement(request, { actorId, type, title, description, audience = "managers" }) {
    const { tenantId } = request;

    const managers =
      audience === "creator"
        ? []
        : await NotificationService.managersOfLocation({
            tenantId,
            locationId: request.toLocationId,
            locationType: request.toLocationType,
          });

    const creator = audience === "managers" ? [] : [request.createdBy];

    const filtered = [...creator, ...managers].filter(
      (id) => String(id) !== String(actorId),
    );

    await NotificationService.notify({
      tenantId,
      recipientIds: filtered,
      type,
      title,
      description,
      link: `/stock-movements/${request._id}`,
      referenceId: request._id,
    });
  }

  _checkLocationAuth(user, locationId, locationType) {
    if (user.role === "TENANT_OWNER") return true;
    if (user.role === "WAREHOUSE_MANAGER" && locationType === "warehouse" && user.warehouseId === locationId.toString()) return true;
    if (user.role === "BRANCH_MANAGER" && locationType === "branch" && user.branchId === locationId.toString()) return true;
    return false;
  }

  async create(user, payload) {
    const { tenantId, userId, role } = user;
    const { movementType } = payload;
    
    // Duplicate Product Validation
    if (payload.details && payload.details.length > 0) {
      const productIds = payload.details.map(d => d.productItemId.toString());
      if (new Set(productIds).size !== productIds.length) {
        throw new Error("Duplicate product items are not allowed");
      }
    }

    if (movementType === "IMPORT") {
      if (role === "BRANCH_MANAGER") throw new Error("Branch Managers cannot create IMPORT requests");
      if (!payload.fromSupplierId) throw new Error("fromSupplierId is required for IMPORT");
      if (!payload.toLocationId || !payload.toLocationType) throw new Error("toLocation is required for IMPORT");
      if (payload.details) {
        for (const item of payload.details) {
          if (!item.importPrice || item.importPrice <= 0) throw new Error("importPrice must be > 0 for IMPORT");
          if (!item.quantity || item.quantity <= 0) throw new Error("quantity must be > 0 for IMPORT");

          const productItem = await mongoose.model("ProductItem").findOne({ _id: item.productItemId, tenantId }).lean();
          if (!productItem) throw new Error("Product item not found");
          if (item.importPrice > productItem.retailPrice) {
            throw new Error(`Import price cannot be greater than retail price (${productItem.retailPrice}) for product item ${productItem.sku}`);
          }
        }
      }
    } else if (movementType === "EXPORT" || movementType === "RETURN") {
      if (!payload.toLocationId || !payload.toLocationType) throw new Error("toLocation is required");
      if (role === "BRANCH_MANAGER" && payload.toLocationType === "warehouse" && movementType === "EXPORT") {
        throw new Error("Branch Managers cannot EXPORT to a warehouse. Use RETURN instead.");
      }
      if (role !== "TENANT_OWNER") {
        payload.fromLocationId = role === "WAREHOUSE_MANAGER" ? user.warehouseId : user.branchId;
        payload.fromLocationType = role === "WAREHOUSE_MANAGER" ? "warehouse" : "branch";
      }
      if (!payload.fromLocationId || !payload.fromLocationType) throw new Error("fromLocation is required");
      if (payload.details) {
        for (const item of payload.details) {
          if (!item.quantity || item.quantity <= 0) throw new Error("quantity must be > 0");
          if (item.importPrice === undefined || item.importPrice === null) {
            const productItem = await mongoose.model("ProductItem").findOne({ _id: item.productItemId, tenantId }).lean();
            item.importPrice = productItem ? (productItem.costPrice || 0) : 0;
          }
        }
      }
    } else if (movementType === "ADJUST") {
      if (role !== "TENANT_OWNER") {
        payload.fromLocationId = role === "WAREHOUSE_MANAGER" ? user.warehouseId : user.branchId;
        payload.fromLocationType = role === "WAREHOUSE_MANAGER" ? "warehouse" : "branch";
      }
      if (!payload.fromLocationId || !payload.fromLocationType) throw new Error("fromLocation is required for ADJUST");
      if (!payload.details || payload.details.length === 0) throw new Error("details are required for ADJUST");
      
      for (const item of payload.details) {
        if (item.receivedQuantity === undefined || item.receivedQuantity === null || item.receivedQuantity < 0) {
          throw new Error("Valid receivedQuantity (>=0) is required for ADJUST details");
        }
        if (item.quantity === undefined || item.quantity === null) {
          const inv = await mongoose.model("Inventory").findOne({
            tenantId,
            locationId: payload.fromLocationId,
            locationType: payload.fromLocationType,
            productItemId: item.productItemId
          });
          item.quantity = inv ? inv.stock : 0;
        }
      }
    }

    let status = "DRAFT";
    if (movementType === "IMPORT" || movementType === "ADJUST") {
      status = "PENDING";
    }

    let totalPrice = 0;
    if (movementType !== "ADJUST" && payload.details) {
      totalPrice = payload.details.reduce((sum, item) => sum + (item.quantity * (item.importPrice || 0)), 0);
    }

    const request = new StockMovementRequest({
      ...payload,
      tenantId,
      createdBy: userId,
      status,
      totalPrice,
    });
    
    await request.save();

    await this._notifyMovement(request, {
      actorId: userId,
      type: "STOCK_MOVEMENT_CREATED",
      title: "Phiếu chuyển kho mới",
      description: `Có phiếu ${movementType} mới cần bạn xử lý.`,
    });

    return request;
  }

  async updateDetails(user, movementId, details) {
    const { tenantId } = user;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await StockMovementRequest.findOne({ _id: movementId, tenantId }).session(session);
      if (!request) throw new Error("Stock movement request not found");

      // Duplicate product check
      if (details && details.length > 0) {
        const productIds = details.map(d => d.productItemId.toString());
        if (new Set(productIds).size !== productIds.length) {
          throw new Error("Duplicate product items are not allowed");
        }
      }

      if (request.movementType === "EXPORT" || request.movementType === "RETURN") {
        if (request.status !== "OPENING") {
          throw new Error("Can only update details when request is OPENING");
        }
        
        // Authorization: either sender or receiver can update when OPENING
        const isSender = this._checkLocationAuth(user, request.fromLocationId, request.fromLocationType);
        const isReceiver = this._checkLocationAuth(user, request.toLocationId, request.toLocationType);
        if (!isSender && !isReceiver) throw new Error("Unauthorized to update details");

        // Check stock limits against fromLocation
        for (const item of details) {
          if (!item.productItemId || !item.quantity || item.quantity <= 0) throw new Error("Valid positive quantity is required");
          
          const inventory = await mongoose.model("Inventory").findOne({
            tenantId,
            locationId: request.fromLocationId,
            locationType: request.fromLocationType,
            productItemId: item.productItemId
          }).session(session);

          const currentStock = inventory ? inventory.stock : 0;
          if (item.quantity > currentStock) {
            throw new Error(`Quantity ${item.quantity} exceeds available stock ${currentStock} at source location`);
          }
          if (item.importPrice === undefined || item.importPrice === null) {
            const productItem = await mongoose.model("ProductItem").findOne({ _id: item.productItemId, tenantId }).lean();
            item.importPrice = productItem ? (productItem.costPrice || 0) : 0;
          }
        }
      } else {
        // IMPORT and ADJUST
        if (request.status !== "PENDING") {
          throw new Error("Can only update details when request is PENDING");
        }

        if (request.movementType === "IMPORT") {
          if (!this._checkLocationAuth(user, request.toLocationId, request.toLocationType)) {
             throw new Error("Unauthorized to update IMPORT details");
          }
          for (const item of details) {
            if (!item.importPrice || item.importPrice <= 0) throw new Error("importPrice must be > 0 for IMPORT");
            if (!item.quantity || item.quantity <= 0) throw new Error("quantity must be > 0 for IMPORT");

            const productItem = await mongoose.model("ProductItem").findOne({ _id: item.productItemId, tenantId }).lean();
            if (!productItem) throw new Error("Product item not found");
            if (item.importPrice > productItem.retailPrice) {
              throw new Error(`Import price cannot be greater than retail price (${productItem.retailPrice}) for product item ${productItem.sku}`);
            }
          }
        }

        if (request.movementType === "ADJUST") {
          if (!this._checkLocationAuth(user, request.fromLocationId, request.fromLocationType)) {
             throw new Error("Unauthorized to update ADJUST details");
          }
          for (const item of details) {
            if (item.receivedQuantity === undefined || item.receivedQuantity === null || item.receivedQuantity < 0) {
              throw new Error("Valid receivedQuantity is required for ADJUST details");
            }
            if (item.quantity === undefined || item.quantity === null) {
              const inv = await mongoose.model("Inventory").findOne({
                tenantId,
                locationId: request.fromLocationId,
                locationType: request.fromLocationType,
                productItemId: item.productItemId
              }).session(session);
              item.quantity = inv ? inv.stock : 0;
            }
          }
        }
      }

      request.details = details;
      if (request.movementType !== "ADJUST") {
        request.totalPrice = details.reduce((sum, item) => sum + (item.quantity * (item.importPrice || 0)), 0);
      }
      await request.save({ session });

      await session.commitTransaction();
      session.endSession();

      return request;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async open(user, movementId) {
    const request = await StockMovementRequest.findOne({ _id: movementId, tenantId: user.tenantId });
    if (!request) throw new Error("Stock movement request not found");

    if (!this._checkLocationAuth(user, request.fromLocationId, request.fromLocationType)) {
      throw new Error("Unauthorized to OPEN request");
    }

    if (request.status !== "DRAFT") throw new Error("Can only OPEN a DRAFT request");
    
    request.status = "OPENING";
    await request.save();
    return request;
  }

  async close(user, movementId) {
    const request = await StockMovementRequest.findOne({ _id: movementId, tenantId: user.tenantId });
    if (!request) throw new Error("Stock movement request not found");

    if (!this._checkLocationAuth(user, request.fromLocationId, request.fromLocationType)) {
      throw new Error("Unauthorized to CLOSE request");
    }

    if (request.status !== "OPENING") throw new Error("Can only CLOSE an OPENING request");
    if (!request.details || request.details.length === 0) throw new Error("Cannot close request without details");
    
    request.status = "CLOSED";
    await request.save();
    return request;
  }

  async ship(user, movementId) {
    const { tenantId } = user;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await StockMovementRequest.findOne({ _id: movementId, tenantId }).session(session);
      if (!request) throw new Error("Stock movement request not found");

      if (!this._checkLocationAuth(user, request.fromLocationId, request.fromLocationType)) {
        throw new Error("Unauthorized to SHIP request");
      }

      if (request.status !== "CLOSED" && request.status !== "PENDING") {
         throw new Error(`Cannot ship from status ${request.status}`);
      }

      // Gom các mặt hàng vừa tụt qua ngưỡng, nhưng chỉ gửi cảnh báo SAU commit.
      const lowStockCrossings = [];

      if (request.movementType === "EXPORT" || request.movementType === "RETURN") {
        for (const item of request.details) {
          const updated = await InventoryService.adjustStock(
            tenantId,
            request.fromLocationId,
            request.fromLocationType,
            item.productItemId,
            -item.quantity,
            session
          );

          lowStockCrossings.push(
            InventoryService.lowStockCrossing(updated, -item.quantity),
          );
        }
      }

      request.status = "IN_TRANSIT";
      await request.save({ session });

      await session.commitTransaction();
      session.endSession();

      await InventoryService.notifyLowStock(lowStockCrossings);

      // Bên nhận cần biết hàng đang trên đường tới.
      await this._notifyMovement(request, {
        actorId: user.userId,
        type: "STOCK_MOVEMENT_IN_TRANSIT",
        title: "Hàng đang được chuyển tới",
        description: "Một phiếu chuyển kho vừa được gửi đi, chờ bạn xác nhận nhận hàng.",
      });

      return request;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async receive(user, movementId, payload) {
    const { tenantId } = user;
    const { details } = payload;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await StockMovementRequest.findOne({ _id: movementId, tenantId }).session(session);
      if (!request) throw new Error("Stock movement request not found");

      if (!this._checkLocationAuth(user, request.toLocationId, request.toLocationType)) {
        throw new Error("Unauthorized to RECEIVE request");
      }

      if (request.movementType === "IMPORT") {
        if (request.status !== "IN_TRANSIT" && request.status !== "PENDING") {
          throw new Error("IMPORT requests must be PENDING or IN_TRANSIT to be received");
        }
      } else {
        if (request.status !== "IN_TRANSIT") {
          throw new Error("Only IN_TRANSIT requests can be received for EXPORT/RETURN");
        }
      }

      let totalImportCost = 0;
      let totalReceivedQty = 0;

      for (const reqItem of request.details) {
        const payloadItem = details.find(d => d.productItemId.toString() === reqItem.productItemId.toString());
        if (payloadItem && payloadItem.receivedQuantity !== undefined && payloadItem.receivedQuantity !== null) {
          const rQ = Number(payloadItem.receivedQuantity);
          if (rQ < 0) throw new Error("Received quantity cannot be negative");

          totalReceivedQty += rQ;
          reqItem.receivedQuantity = rQ;
          
          if (request.movementType === "IMPORT" && reqItem.importPrice) {
            totalImportCost += (rQ * reqItem.importPrice);
          }

          if (rQ > 0) {
            await InventoryService.adjustStock(
              tenantId,
              request.toLocationId,
              request.toLocationType,
              reqItem.productItemId,
              rQ,
              session
            );
          }
        } else {
          throw new Error(`Missing receivedQuantity for product item ${reqItem.productItemId}`);
        }
      }

      if (totalReceivedQty === 0) {
        throw new Error("Cannot receive an empty order. Received quantity must be > 0 for at least one item.");
      }

      if (request.movementType === "IMPORT" && request.fromSupplierId && totalImportCost > 0) {
        await Supplier.findOneAndUpdate(
          { _id: request.fromSupplierId, tenantId },
          { $inc: { outstandingDebt: totalImportCost } },
          { session }
        );
      }

      if (request.movementType === "IMPORT" && request.fromSupplierId) {
        const receivedProductItemIds = request.details
          .filter(reqItem => reqItem.receivedQuantity > 0)
          .map(reqItem => reqItem.productItemId);

        if (receivedProductItemIds.length > 0) {
          await mongoose.model("ProductItem").updateMany(
            { _id: { $in: receivedProductItemIds }, tenantId },
            { $addToSet: { suppliers: request.fromSupplierId } },
            { session }
          );
        }
      }

      request.status = "RECEIVED";
      await request.save({ session });

      await session.commitTransaction();
      session.endSession();

      // Người tạo phiếu cần biết hàng đã tới nơi.
      await this._notifyMovement(request, {
        actorId: user.userId,
        type: "STOCK_MOVEMENT_RECEIVED",
        title: "Phiếu chuyển kho đã được nhận",
        description: "Bên nhận đã xác nhận nhận đủ hàng cho phiếu bạn tạo.",
        audience: "creator",
      });

      return request;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async approveAdjust(user, movementId) {
    const { tenantId } = user;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await StockMovementRequest.findOne({ _id: movementId, tenantId }).session(session);
      if (!request) throw new Error("Stock movement request not found");

      if (!this._checkLocationAuth(user, request.fromLocationId, request.fromLocationType)) {
        throw new Error("Unauthorized to approve ADJUST request");
      }

      if (request.movementType !== "ADJUST") throw new Error("Only ADJUST requests can be approved this way");
      if (request.status !== "PENDING") throw new Error("Can only approve PENDING adjust requests");

      let hasDifference = false;
      for (const item of request.details) {
        if (item.receivedQuantity === undefined || item.receivedQuantity === null) {
          throw new Error(`Missing receivedQuantity for product ${item.productItemId}`);
        }
        const difference = item.receivedQuantity - item.quantity;
        if (difference !== 0) {
          hasDifference = true;
          await InventoryService.adjustStock(
            tenantId,
            request.fromLocationId,
            request.fromLocationType,
            item.productItemId,
            difference,
            session
          );
        }
      }

      if (!hasDifference) {
         throw new Error("No adjustments found. Received quantity equals system quantity for all items.");
      }

      request.status = "COMPLETED";
      await request.save({ session });

      await session.commitTransaction();
      session.endSession();

      return request;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async cancel(user, movementId) {
    const { tenantId } = user;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await StockMovementRequest.findOne({ _id: movementId, tenantId }).session(session);
      if (!request) throw new Error("Stock movement request not found");

      if (!this._checkLocationAuth(user, request.fromLocationId, request.fromLocationType)) {
        throw new Error("Unauthorized to CANCEL request");
      }

      if (request.status === "RECEIVED" || request.status === "COMPLETED" || request.status === "CANCELLED") {
        throw new Error(`Cannot cancel a ${request.status} request`);
      }

      if (request.status === "IN_TRANSIT" && (request.movementType === "EXPORT" || request.movementType === "RETURN")) {
        for (const item of request.details) {
          await InventoryService.adjustStock(
            tenantId,
            request.fromLocationId,
            request.fromLocationType,
            item.productItemId,
            item.quantity,
            session
          );
        }
      }

      request.status = "CANCELLED";
      await request.save({ session });

      await session.commitTransaction();
      session.endSession();

      // Huỷ có thể do bên gửi HOẶC bên nhận thực hiện, nên báo cho cả hai phía
      // trong một lần gửi. actorId lọc người bấm huỷ ra khỏi danh sách.
      await this._notifyMovement(request, {
        actorId: user.userId,
        type: "STOCK_MOVEMENT_CANCELLED",
        title: "Phiếu chuyển kho đã bị hủy",
        description: "Một phiếu chuyển kho liên quan đến bạn đã bị hủy.",
        audience: "both",
      });

      return request;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async getList(user, query) {
    const { tenantId, role, warehouseId, branchId } = user;
    const { page = 1, limit = 10, status, movementType } = query;
    const skip = (page - 1) * limit;

    const filter = { tenantId };
    if (status) filter.status = status;
    if (movementType) filter.movementType = movementType;

    // Filter by role/location
    if (role === "WAREHOUSE_MANAGER") {
      filter.$or = [{ fromLocationId: warehouseId }, { toLocationId: warehouseId }];
    } else if (role === "BRANCH_MANAGER") {
      filter.$or = [{ fromLocationId: branchId }, { toLocationId: branchId }];
    }

    const [data, total] = await Promise.all([
      StockMovementRequest.find(filter)
        .populate("createdBy", "fullName email")
        .populate("fromSupplierId", "supplierName")
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 })
        .lean(),
      StockMovementRequest.countDocuments(filter),
    ]);

    await this._attachLocationNamesToMultiple(data);

    return {
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDetail(user, movementId) {
    const { tenantId, role, warehouseId, branchId } = user;
    const request = await StockMovementRequest.findOne({ _id: movementId, tenantId })
      .populate("createdBy", "fullName email")
      .populate("fromSupplierId", "supplierName")
      .populate("details.productItemId", "sku productName images")
      .lean();
      
    if (!request) throw new Error("Stock movement request not found");

    // Enforce view authorization
    if (role === "WAREHOUSE_MANAGER") {
      if (request.fromLocationId?.toString() !== warehouseId && request.toLocationId?.toString() !== warehouseId) {
         throw new Error("Unauthorized to view this request");
      }
    } else if (role === "BRANCH_MANAGER") {
      if (request.fromLocationId?.toString() !== branchId && request.toLocationId?.toString() !== branchId) {
         throw new Error("Unauthorized to view this request");
      }
    }

    await this._attachLocationNamesToMultiple([request]);

    return request;
  }

  async _attachLocationNamesToMultiple(requests) {
    const branchIds = new Set();
    const warehouseIds = new Set();

    requests.forEach(r => {
      if (r.fromLocationId) {
        if (r.fromLocationType === 'branch') branchIds.add(r.fromLocationId.toString());
        else if (r.fromLocationType === 'warehouse') warehouseIds.add(r.fromLocationId.toString());
      }
      if (r.toLocationId) {
        if (r.toLocationType === 'branch') branchIds.add(r.toLocationId.toString());
        else if (r.toLocationType === 'warehouse') warehouseIds.add(r.toLocationId.toString());
      }
    });

    const [branches, warehouses] = await Promise.all([
      Branch.find({ _id: { $in: Array.from(branchIds) } }).select("name").lean(),
      Warehouse.find({ _id: { $in: Array.from(warehouseIds) } }).select("name").lean()
    ]);

    const locationMap = {};
    branches.forEach(b => locationMap[b._id.toString()] = b.name);
    warehouses.forEach(w => locationMap[w._id.toString()] = w.name);

    requests.forEach(r => {
      if (r.fromLocationId) r.fromLocationName = locationMap[r.fromLocationId.toString()] || null;
      if (r.toLocationId) r.toLocationName = locationMap[r.toLocationId.toString()] || null;
    });
  }
}

module.exports = new StockMovementService();
