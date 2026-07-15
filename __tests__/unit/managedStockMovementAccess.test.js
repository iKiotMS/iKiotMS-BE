const StockMovementService = require("../../src/modules/stock-movement/service/StockMovementService");
const {
  MANAGED_STOCK_MOVEMENT_TYPES,
} = require("../../src/services/managedScheduleAccessService");

describe("Managed schedule stock movement scope", () => {
  const managedStaff = {
    role: "STAFF",
    managedScheduleAccess: {
      temporary: true,
      branchIds: ["branch-1"],
      warehouseIds: ["warehouse-1"],
    },
  };

  test("does not grant IMPORT stock movement access to managed staff", () => {
    expect(MANAGED_STOCK_MOVEMENT_TYPES).toEqual([
      "EXPORT",
      "ADJUST",
      "RETURN",
    ]);
    expect(MANAGED_STOCK_MOVEMENT_TYPES).not.toContain("IMPORT");
    expect(MANAGED_STOCK_MOVEMENT_TYPES).not.toContain("TRANSFER");
  });

  test("rejects managed staff creating an IMPORT request", async () => {
    await expect(
      StockMovementService.create(managedStaff, { movementType: "IMPORT" }),
    ).rejects.toMatchObject({
      message: "Managed staff cannot access IMPORT requests",
      statusCode: 403,
    });
  });

  test("allows only locations from the active managed schedule", () => {
    expect(
      StockMovementService._checkLocationAuth(
        managedStaff,
        "branch-1",
        "branch",
      ),
    ).toBe(true);
    expect(
      StockMovementService._checkLocationAuth(
        managedStaff,
        "warehouse-1",
        "warehouse",
      ),
    ).toBe(true);
    expect(
      StockMovementService._checkLocationAuth(
        managedStaff,
        "branch-2",
        "branch",
      ),
    ).toBe(false);

  });
});
