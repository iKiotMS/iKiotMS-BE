const mongoose = require("mongoose");
const StockMovementService = require("../../src/modules/stock-movement/service/StockMovementService");
const { StockMovementRequest, Inventory, ProductItem } = require("../../src/models");

describe("StockMovement validation rules", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const productItemId = new mongoose.Types.ObjectId();

  const user = {
    tenantId,
    userId,
    role: "TENANT_OWNER",
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("rejects creating a stock movement when source and destination locations are identical", async () => {
    await expect(
      StockMovementService.create(user, {
        movementType: "EXPORT",
        fromLocationId: branchId,
        fromLocationType: "branch",
        toLocationId: branchId,
        toLocationType: "branch",
      })
    ).rejects.toThrow("Source and destination locations cannot be the same");
  });

  test("rejects creating an EXPORT request when item quantity exceeds available stock", async () => {
    const destBranchId = new mongoose.Types.ObjectId();

    jest.spyOn(ProductItem, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: productItemId, costPrice: 100 }),
    });

    jest.spyOn(Inventory, "findOne").mockResolvedValue({
      stock: 7,
    });

    await expect(
      StockMovementService.create(user, {
        movementType: "EXPORT",
        fromLocationId: branchId,
        fromLocationType: "branch",
        toLocationId: destBranchId,
        toLocationType: "branch",
        details: [
          {
            productItemId,
            quantity: 10,
          },
        ],
      })
    ).rejects.toThrow("Quantity 10 exceeds available stock 7 at source location");
  });

  test("rejects shipping an EXPORT request when stock is lower than item quantity", async () => {
    const movementId = new mongoose.Types.ObjectId();
    const destBranchId = new mongoose.Types.ObjectId();

    const fakeRequest = {
      _id: movementId,
      movementType: "EXPORT",
      status: "CLOSED",
      fromLocationId: branchId,
      fromLocationType: "branch",
      toLocationId: destBranchId,
      toLocationType: "branch",
      details: [
        {
          productItemId,
          quantity: 10,
        },
      ],
      save: jest.fn(),
    };

    const fakeSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(fakeSession);

    const mockReqQuery = {
      session: jest.fn().mockReturnThis(),
      then: (resolve) => resolve(fakeRequest),
    };
    jest.spyOn(StockMovementRequest, "findOne").mockReturnValue(mockReqQuery);

    const mockInvQuery = {
      session: jest.fn().mockReturnThis(),
      then: (resolve) => resolve({ stock: 5 }),
    };
    jest.spyOn(Inventory, "findOne").mockReturnValue(mockInvQuery);

    await expect(
      StockMovementService.ship(user, movementId)
    ).rejects.toThrow("Quantity 10 exceeds available stock 5 at source location");

    expect(fakeSession.abortTransaction).toHaveBeenCalled();
  });
});
