const mongoose = require("mongoose");
const { StockMovementRequest, Supplier, Branch, Warehouse } = require("../../../models");
const InventoryService = require("../../inventory/service/InventoryService");

class StockMovementService {
  async create(tenantId, userId, payload) {
    const { movementType } = payload;
    
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

  async updateDetails(tenantId, movementId, details, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await StockMovementRequest.findOne({ _id: movementId, tenantId }).session(session);
      if (!request) throw new Error("Stock movement request not found");

      if (request.movementType === "EXPORT" || request.movementType === "RETURN") {
        if (request.status !== "OPENING") {
          throw new Error("Can only update details when request is OPENING");
        }
        // Check stock limits against fromLocation
        for (const item of details) {
          if (!item.productItemId || !item.quantity) throw new Error("Invalid details payload");
          
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

  async open(tenantId, movementId, userId) {
    const request = await StockMovementRequest.findOne({ _id: movementId, tenantId });
    if (!request) throw new Error("Stock movement request not found");

    if (request.status !== "DRAFT") throw new Error("Can only OPEN a DRAFT request");
    
    request.status = "OPENING";
    await request.save();
    return request;
  }

  async close(tenantId, movementId, userId) {
    const request = await StockMovementRequest.findOne({ _id: movementId, tenantId });
    if (!request) throw new Error("Stock movement request not found");

    if (request.status !== "OPENING") throw new Error("Can only CLOSE an OPENING request");
    if (!request.details || request.details.length === 0) throw new Error("Cannot close request without details");
    
    request.status = "CLOSED";
    await request.save();
    return request;
  }

  async ship(tenantId, movementId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await StockMovementRequest.findOne({ _id: movementId, tenantId }).session(session);
      if (!request) throw new Error("Stock movement request not found");

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

  async receive(tenantId, movementId, payload, userId) {
    const { details } = payload;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await StockMovementRequest.findOne({ _id: movementId, tenantId }).session(session);
      if (!request) throw new Error("Stock movement request not found");

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

      for (const reqItem of request.details) {
        const payloadItem = details.find(d => d.productItemId.toString() === reqItem.productItemId.toString());
        if (payloadItem && payloadItem.receivedQuantity !== undefined && payloadItem.receivedQuantity !== null) {
          const rQ = Number(payloadItem.receivedQuantity);
          if (rQ < 0) throw new Error("Received quantity cannot be negative");

          reqItem.receivedQuantity = rQ;
          
          if (request.movementType === "IMPORT" && reqItem.importPrice) {
            totalImportCost += (rQ * reqItem.importPrice);
          }

          await InventoryService.adjustStock(
            tenantId,
            request.toLocationId,
            request.toLocationType,
            reqItem.productItemId,
            rQ,
            session
          );
        } else {
          throw new Error(`Missing receivedQuantity for product item ${reqItem.productItemId}`);
        }
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

  async approveAdjust(tenantId, movementId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await StockMovementRequest.findOne({ _id: movementId, tenantId }).session(session);
      if (!request) throw new Error("Stock movement request not found");

      if (request.movementType !== "ADJUST") throw new Error("Only ADJUST requests can be approved this way");
      if (request.status !== "PENDING") throw new Error("Can only approve PENDING adjust requests");

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

  async cancel(tenantId, movementId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await StockMovementRequest.findOne({ _id: movementId, tenantId }).session(session);
      if (!request) throw new Error("Stock movement request not found");

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

  async getList(tenantId, query) {
    const { page = 1, limit = 10, status, movementType } = query;
    const skip = (page - 1) * limit;

    const filter = { tenantId };
    if (status) filter.status = status;
    if (movementType) filter.movementType = movementType;

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

  async getDetail(tenantId, movementId) {
    const request = await StockMovementRequest.findOne({ _id: movementId, tenantId })
      .populate("createdBy", "fullName email")
      .populate("fromSupplierId", "supplierName")
      .populate("details.productItemId", "sku productName images")
      .lean();
      
    if (!request) throw new Error("Stock movement request not found");

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
