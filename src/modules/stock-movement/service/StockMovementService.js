const mongoose = require("mongoose");
const { StockMovementRequest, Supplier } = require("../../../models");
const InventoryService = require("../../inventory/service/InventoryService");

class StockMovementService {
  async create(tenantId, userId, payload) {
    const { movementType, fromLocationId, fromLocationType, details } = payload;

    // Validate TRANSFER requires fromLocation
    if (movementType === "TRANSFER" && (!fromLocationId || !fromLocationType)) {
      throw new Error("TRANSFER requires fromLocationId and fromLocationType");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = new StockMovementRequest({
        ...payload,
        tenantId,
        requestedBy: userId,
        status: "PENDING",
      });

      // If TRANSFER, we must reserve stock immediately from fromLocation
      if (movementType === "TRANSFER") {
        for (const item of details) {
          // Adjust stock negatively
          await InventoryService.adjustStock(
            tenantId,
            fromLocationId,
            fromLocationType,
            item.productItemId,
            -item.quantity,
            session
          );
        }
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

  async approve(tenantId, movementId, userId) {
    const request = await StockMovementRequest.findOne({ _id: movementId, tenantId });
    if (!request) throw new Error("Stock movement request not found");
    
    if (request.status !== "PENDING") {
      throw new Error("Only PENDING requests can be approved");
    }

    request.status = "IN_TRANSIT";
    request.approvedBy = userId;
    await request.save();

    return request;
  }

  async receive(tenantId, movementId, payload, userId) {
    // payload.details should contain [{ productItemId, receivedQuantity }]
    const { details } = payload;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await StockMovementRequest.findOne({ _id: movementId, tenantId }).session(session);
      if (!request) throw new Error("Stock movement request not found");

      if (request.status !== "IN_TRANSIT" && request.status !== "PENDING") {
        throw new Error("Cannot receive this request");
      }

      let totalImportCost = 0;

      // Update received quantities and calculate cost
      for (const reqItem of request.details) {
        const payloadItem = details.find(d => d.productItemId.toString() === reqItem.productItemId.toString());
        if (payloadItem) {
          reqItem.receivedQuantity = payloadItem.receivedQuantity;
          
          if (request.movementType === "IMPORT" && reqItem.importPrice) {
            totalImportCost += (reqItem.receivedQuantity * reqItem.importPrice);
          }

          // Add stock to destination
          await InventoryService.adjustStock(
            tenantId,
            request.toLocationId,
            request.toLocationType,
            reqItem.productItemId,
            reqItem.receivedQuantity,
            session
          );
        }
      }

      // If it's an IMPORT, increase Supplier outstandingDebt
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

  async cancel(tenantId, movementId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await StockMovementRequest.findOne({ _id: movementId, tenantId }).session(session);
      if (!request) throw new Error("Stock movement request not found");

      if (request.status === "RECEIVED" || request.status === "CANCELLED") {
        throw new Error("Cannot cancel a completed or already cancelled request");
      }

      // If TRANSFER, rollback reserved stock
      if (request.movementType === "TRANSFER") {
        for (const item of request.details) {
          await InventoryService.adjustStock(
            tenantId,
            request.fromLocationId,
            request.fromLocationType,
            item.productItemId,
            item.quantity, // Give it back
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
        .populate("requestedBy", "fullName email")
        .populate("approvedBy", "fullName email")
        .populate("fromSupplierId", "supplierName")
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 })
        .lean(),
      StockMovementRequest.countDocuments(filter),
    ]);

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
      .populate("requestedBy", "fullName email")
      .populate("approvedBy", "fullName email")
      .populate("fromSupplierId", "supplierName")
      .populate("details.productItemId", "sku productName images")
      .lean();
      
    if (!request) throw new Error("Stock movement request not found");
    return request;
  }
}

module.exports = new StockMovementService();
