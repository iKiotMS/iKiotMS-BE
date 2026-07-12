const mongoose = require("mongoose");
const { StockMovementRequest, Supplier, Branch, Warehouse } = require("../../../models");
const InventoryService = require("../../inventory/service/InventoryService");

class StockMovementService {
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
        payload.details.forEach(item => {
          if (!item.importPrice || item.importPrice <= 0) throw new Error("importPrice must be > 0 for IMPORT");
          if (!item.quantity || item.quantity <= 0) throw new Error("quantity must be > 0 for IMPORT");
        });
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
        payload.details.forEach(item => {
          if (!item.quantity || item.quantity <= 0) throw new Error("quantity must be > 0");
        });
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

    const request = new StockMovementRequest({
      ...payload,
      tenantId,
      createdBy: userId,
      status,
    });
    
    await request.save();
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

      if (request.movementType === "EXPORT" || request.movementType === "RETURN") {
        for (const item of request.details) {
          await InventoryService.adjustStock(
            tenantId,
            request.fromLocationId,
            request.fromLocationType,
            item.productItemId,
            -item.quantity,
            session
          );
        }
      }

      request.status = "IN_TRANSIT";
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
          
          if (request.movementType === "EXPORT" || request.movementType === "RETURN") {
            if (rQ > reqItem.quantity) {
              throw new Error(`Received quantity cannot exceed shipped quantity for item ${reqItem.productItemId}`);
            }
          }

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

      request.status = "RECEIVED";
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
