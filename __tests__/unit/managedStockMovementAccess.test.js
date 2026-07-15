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

  test("uses the four stock movement types implemented by the model", () => {
    expect(MANAGED_STOCK_MOVEMENT_TYPES).toEqual([
      "IMPORT",
      "EXPORT",
      "ADJUST",
      "RETURN",
    ]);
    expect(MANAGED_STOCK_MOVEMENT_TYPES).not.toContain("TRANSFER");
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
