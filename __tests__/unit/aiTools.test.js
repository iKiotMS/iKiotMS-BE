const aiTools = require("../../src/modules/ai/service/ai.tools");

describe("AI Tools Module Test", () => {
  test("All expected tools are exported", () => {
    const expectedTools = [
      "searchProducts",
      "getProductStockLevel",
      "getProductCategories",
      "getProductBrands",
      "searchCustomers",
      "getCustomerPurchaseHistory",
      "getBranchList",
      "getWarehouseList",
      "getSupplierList",
      "getStaffList",
      "getStaffAttendanceReport",
      "getLeaveRequests",
      "getStaffWorkingSchedule",
      "getPayrollSummary",
      "getActivePromotions",
      "getTenantSubscriptionInfo",
      "getInventoryList",
      "searchOrders",
      "getRecentOrders",
      "getOrderDetailsByCode",
      "getStockMovementHistory",
      "getRevenueOverview",
      "getRevenueSeries",
      "getRevenueByPaymentMethod",
      "getRevenueByStaff",
      "getTopProducts",
      "getInventoryOverviewStats",
      "getCashflowSummary",
      "getCashDrawerSessions",
      "getTenantTickets",
    ];

    expectedTools.forEach((toolName) => {
      expect(typeof aiTools[toolName]).toBe("function");
    });
  });
});
