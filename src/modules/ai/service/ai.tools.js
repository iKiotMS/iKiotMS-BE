const mongoose = require("mongoose");
const {
  Supplier,
  Promotion,
  Subscription,
  Order,
  StockMovementRequest,
  Ticket,
  CashDrawerSession,
} = require("../../../models");

const ProductService = require("../../product/service/ProductService");
const CategoryService = require("../../category/service/CategoryService");
const BrandService = require("../../brand/service/BrandService");
const CustomerService = require("../../order/service/CustomerService");
const OrderService = require("../../order/service/OrderService");
const BranchService = require("../../branch/service/BranchService");
const WarehouseService = require("../../warehouse/service/WarehouseService");
const StaffService = require("../../staff/service/StaffService");
const { ManageAttendanceService } = require("../../attendances/service/ManageAttendanceService");
const LeaveRequestService = require("../../leaveRequest/service/LeaveRequestService");
const WorkingScheduleService = require("../../schedule/service/WorkingScheduleService");
const PaySheetService = require("../../payroll/service/PaySheetService");
const InventoryService = require("../../inventory/service/InventoryService");
const StatsService = require("../../stats/service/StatsService");
const { attachUserName, USER_NAME_SELECT } = require("../../../utils/userName");

const manageAttendanceService = new ManageAttendanceService();

/**
 * 1. searchProducts
 */
async function searchProducts(tenantId, query) {
  const page = query?.page || 1;
  const limit = query?.limit || 10;
  const searchKeyword = query?.search || query?.q;
  return await ProductService.searchProducts(tenantId, {
    q: searchKeyword,
    ...query,
    page,
    limit,
  });
}

/**
 * 2. getProductStockLevel
 */
async function getProductStockLevel(tenantId, { productId }) {
  if (!productId) {
    throw new Error("productId is required");
  }
  let targetId = productId;
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    const searchRes = await ProductService.searchProducts(tenantId, { q: productId, limit: 1 });
    if (searchRes?.data?.length > 0) {
      targetId = searchRes.data[0]._id;
    } else {
      throw new Error(`Product not found for: ${productId}`);
    }
  }
  return await ProductService.getProductById(tenantId, targetId);
}

/**
 * 3. getProductCategories
 */
async function getProductCategories(tenantId, query) {
  const page = query?.page || 1;
  const limit = query?.limit || 100;
  return await CategoryService.getList({ ...query, page, limit });
}

/**
 * 4. getProductBrands
 */
async function getProductBrands(tenantId, query) {
  const page = query?.page || 1;
  const limit = query?.limit || 100;
  return await BrandService.getList({ ...query, page, limit });
}

/**
 * 5. searchCustomers
 */
async function searchCustomers(tenantId, query) {
  const page = query?.page || 1;
  const limit = query?.limit || 10;
  return await CustomerService.getCustomers(tenantId, { ...query, page, limit });
}

/**
 * 6. getCustomerPurchaseHistory
 */
async function getCustomerPurchaseHistory(tenantId, { customerId }) {
  if (!customerId) {
    throw new Error("customerId is required");
  }
  let targetId = customerId;
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    const searchRes = await CustomerService.getCustomers(tenantId, { search: customerId, page: 1, limit: 1 });
    if (searchRes?.data?.length > 0) {
      targetId = searchRes.data[0]._id;
    } else {
      throw new Error(`Customer not found for: ${customerId}`);
    }
  }
  const customer = await CustomerService.getCustomerById(tenantId, targetId);
  const orders = await Order.find({ tenantId, customerId: targetId })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("branchId", "name")
    .populate("items.productItemId", "sku productName")
    .lean();

  return {
    customer,
    purchaseHistory: orders,
    totalOrders: orders.length,
    totalSpent: orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0),
  };
}

/**
 * 7. getBranchList
 */
async function getBranchList(tenantId, query) {
  const page = query?.page || 1;
  const limit = query?.limit || 100;
  return await BranchService.getBranches(tenantId, { ...query, page, limit });
}

/**
 * 8. getWarehouseList
 */
async function getWarehouseList(tenantId, query) {
  const page = query?.page || 1;
  const limit = query?.limit || 100;
  return await WarehouseService.getWarehouses(tenantId, { ...query, page, limit });
}

/**
 * 9. getSupplierList
 */
async function getSupplierList(tenantId, query) {
  const search = query?.search;
  const filter = { tenantId, isDeleted: { $ne: true } };
  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }
  return await Supplier.find(filter).lean();
}

/**
 * 10. getStaffList
 */
async function getStaffList(tenantId, query) {
  const page = query?.page || 1;
  const recordPerPage = query?.recordPerPage || 10;
  return await StaffService.getStaffList({
    tenantId,
    requesterRole: "TENANT_OWNER",
    ...query,
    page,
    recordPerPage,
  });
}

/**
 * 11. getStaffAttendanceReport
 */
async function getStaffAttendanceReport(tenantId, query) {
  const page = query?.page || 1;
  const recordPerPage = query?.recordPerPage || 10;
  const result = await manageAttendanceService.getAttendances(tenantId, {
    ...query,
    page,
    recordPerPage,
  });

  if (result?.data?.length > 0) {
    const userIds = result.data.map((a) => a.userId).filter(Boolean);
    const users = await mongoose
      .model("User")
      .find({ _id: { $in: userIds } })
      .select("profile.firstName profile.lastName email phoneNumber role")
      .lean();
    const userMap = {};
    users.forEach((u) => {
      userMap[u._id.toString()] = {
        name: `${u.profile?.firstName || ""} ${u.profile?.lastName || ""}`.trim() || u.email || u.phoneNumber,
        email: u.email,
        role: u.role,
      };
    });
    result.data = result.data.map((a) => ({
      ...a,
      userInfo: userMap[a.userId?.toString()] || null,
    }));
  }
  return result;
}

/**
 * 12. getLeaveRequests
 */
async function getLeaveRequests(tenantId, query) {
  const page = query?.page || 1;
  const recordPerPage = query?.recordPerPage || 10;
  return await LeaveRequestService.getLeaveRequests({
    tenantId,
    filter: query,
    page,
    recordPerPage,
  });
}

/**
 * 13. getStaffWorkingSchedule
 */
async function getStaffWorkingSchedule(tenantId, query) {
  const page = query?.page || 1;
  const recordPerPage = query?.recordPerPage || 10;
  return await WorkingScheduleService.getWorkingScheduleList(tenantId, {
    ...query,
    page,
    recordPerPage,
  });
}

/**
 * 14. getPayrollSummary
 */
async function getPayrollSummary(tenantId, query) {
  const page = query?.page || 1;
  const recordPerPage = query?.recordPerPage || 10;
  return await PaySheetService.getPaySheetList(
    tenantId,
    query || {},
    page,
    recordPerPage,
    null,
    "TENANT_OWNER"
  );
}

/**
 * 15. getActivePromotions
 */
async function getActivePromotions(tenantId, query) {
  const filter = { tenantId, status: "ACTIVE" };
  const search = query?.search;
  if (search) {
    filter.promoName = { $regex: search, $options: "i" };
  }
  return await Promotion.find(filter).lean();
}

/**
 * 16. getTenantSubscriptionInfo
 */
async function getTenantSubscriptionInfo(tenantId) {
  return await Subscription.findOne({ tenantId, status: "ACTIVE" }).populate("planId").lean();
}

/**
 * 17. getInventoryList
 */
async function getInventoryList(tenantId, query) {
  const page = query?.page || 1;
  const limit = query?.limit || 10;
  return await InventoryService.getInventories(tenantId, { ...query, page, limit });
}

/**
 * 18. searchOrders
 */
async function searchOrders(tenantId, query) {
  const page = query?.page || 1;
  const limit = query?.limit || 10;
  return await OrderService.getOrders(tenantId, { ...query, page, limit });
}

/**
 * 19. getRecentOrders
 */
async function getRecentOrders(tenantId, query) {
  const limit = query?.limit || 10;
  return await OrderService.getOrders(tenantId, { ...query, page: 1, limit });
}

/**
 * 20. getOrderDetailsByCode
 */
async function getOrderDetailsByCode(tenantId, { orderCode }) {
  if (!orderCode) {
    throw new Error("orderCode is required");
  }
  if (mongoose.Types.ObjectId.isValid(orderCode)) {
    return await OrderService.getOrderById(tenantId, orderCode);
  }

  const order = await Order.findOne({
    tenantId,
    $or: [
      { paymentReference: orderCode },
      { paymentReference: { $regex: new RegExp(`^${orderCode}$`, "i") } },
    ],
  })
    .populate("customerId", "name phone")
    .populate("userId", USER_NAME_SELECT)
    .populate("items.productItemId", "sku productName")
    .lean();

  if (!order) {
    throw new Error(`Order not found for code: ${orderCode}`);
  }
  attachUserName(order.userId);
  return order;
}

/**
 * 21. getStockMovementHistory
 */
async function getStockMovementHistory(tenantId, query) {
  const search = query?.search;
  const filter = { tenantId };
  if (search) {
    filter.requestNumber = { $regex: search, $options: "i" };
  }
  return await StockMovementRequest.find(filter)
    .populate("originBranchId", "name")
    .populate("destinationBranchId", "name")
    .populate("items.productItemId", "sku productName")
    .lean();
}

/**
 * 22. getRevenueOverview
 */
async function getRevenueOverview(tenantId, query) {
  const now = new Date();
  const fromDate = query?.fromDate ? new Date(query.fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = query?.toDate ? new Date(query.toDate) : now;
  const mockUser = { tenantId, role: "TENANT_OWNER" };
  return await StatsService.getOverview(mockUser, {
    fromDate,
    toDate,
    branchId: query?.branchId,
  });
}

/**
 * 23. getRevenueSeries
 */
async function getRevenueSeries(tenantId, query) {
  const now = new Date();
  const fromDate = query?.fromDate ? new Date(query.fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = query?.toDate ? new Date(query.toDate) : now;
  const mockUser = { tenantId, role: "TENANT_OWNER" };
  return await StatsService.getRevenueSeries(mockUser, {
    fromDate,
    toDate,
    branchId: query?.branchId,
    groupBy: query?.groupBy || "day",
  });
}

/**
 * 24. getRevenueByPaymentMethod
 */
async function getRevenueByPaymentMethod(tenantId, query) {
  const now = new Date();
  const fromDate = query?.fromDate ? new Date(query.fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = query?.toDate ? new Date(query.toDate) : now;
  const mockUser = { tenantId, role: "TENANT_OWNER" };
  return await StatsService.getRevenueByPaymentMethod(mockUser, {
    fromDate,
    toDate,
    branchId: query?.branchId,
  });
}

/**
 * 25. getRevenueByStaff
 */
async function getRevenueByStaff(tenantId, query) {
  const now = new Date();
  const fromDate = query?.fromDate ? new Date(query.fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = query?.toDate ? new Date(query.toDate) : now;
  const mockUser = { tenantId, role: "TENANT_OWNER" };
  return await StatsService.getRevenueByStaff(mockUser, {
    fromDate,
    toDate,
    branchId: query?.branchId,
  });
}

/**
 * 26. getTopProducts
 */
async function getTopProducts(tenantId, query) {
  const now = new Date();
  const fromDate = query?.fromDate ? new Date(query.fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = query?.toDate ? new Date(query.toDate) : now;
  const mockUser = { tenantId, role: "TENANT_OWNER" };
  return await StatsService.getTopProducts(mockUser, {
    fromDate,
    toDate,
    branchId: query?.branchId,
    sortBy: query?.sortBy || "quantity",
    limit: query?.limit || 10,
  });
}

/**
 * 27. getInventoryOverviewStats
 */
async function getInventoryOverviewStats(tenantId, query) {
  const mockUser = { tenantId, role: "TENANT_OWNER" };
  return await StatsService.getInventory(mockUser, {
    branchId: query?.branchId,
    warehouseId: query?.warehouseId,
    lowStockThreshold: query?.lowStockThreshold || 10,
  });
}

/**
 * 28. getCashflowSummary
 */
async function getCashflowSummary(tenantId, query) {
  const now = new Date();
  const fromDate = query?.fromDate ? new Date(query.fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = query?.toDate ? new Date(query.toDate) : now;
  const mockUser = { tenantId, role: "TENANT_OWNER" };
  const summary = await StatsService.getCashflow(mockUser, {
    fromDate,
    toDate,
    branchId: query?.branchId,
    warehouseId: query?.warehouseId,
    flowType: query?.flowType,
  });
  const list = await StatsService.getCashflowList(mockUser, {
    fromDate,
    toDate,
    branchId: query?.branchId,
    warehouseId: query?.warehouseId,
    flowType: query?.flowType,
    page: query?.page || 1,
    limit: query?.limit || 10,
  });
  return { summary, recentTransactions: list.data, pagination: list.pagination };
}

/**
 * 29. getCashDrawerSessions
 */
async function getCashDrawerSessions(tenantId, query) {
  const page = query?.page || 1;
  const limit = query?.limit || 10;
  const skip = (page - 1) * limit;
  const filter = { tenantId };
  if (query?.branchId) filter.branchId = query.branchId;
  if (query?.status) filter.status = query.status;

  const [data, total] = await Promise.all([
    CashDrawerSession.find(filter)
      .sort({ businessDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("branchId", "name")
      .populate("openedBy currentStaffId", "profile.firstName profile.lastName phoneNumber")
      .lean(),
    CashDrawerSession.countDocuments(filter),
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
 * 30. getTenantTickets
 */
async function getTenantTickets(tenantId, query) {
  const page = query?.page || 1;
  const limit = query?.limit || 10;
  const skip = (page - 1) * limit;
  const filter = { tenantId, isDeletedByTenant: { $ne: true } };
  if (query?.status) filter.status = query.status;

  const [data, total] = await Promise.all([
    Ticket.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Ticket.countDocuments(filter),
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

module.exports = {
  searchProducts,
  getProductStockLevel,
  getProductCategories,
  getProductBrands,
  searchCustomers,
  getCustomerPurchaseHistory,
  getBranchList,
  getWarehouseList,
  getSupplierList,
  getStaffList,
  getStaffAttendanceReport,
  getLeaveRequests,
  getStaffWorkingSchedule,
  getPayrollSummary,
  getActivePromotions,
  getTenantSubscriptionInfo,
  getInventoryList,
  searchOrders,
  getRecentOrders,
  getOrderDetailsByCode,
  getStockMovementHistory,
  getRevenueOverview,
  getRevenueSeries,
  getRevenueByPaymentMethod,
  getRevenueByStaff,
  getTopProducts,
  getInventoryOverviewStats,
  getCashflowSummary,
  getCashDrawerSessions,
  getTenantTickets,
};
