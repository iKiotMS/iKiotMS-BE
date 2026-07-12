const mongoose = require("mongoose");
const {
  Supplier,
  Promotion,
  Subscription,
  Order,
  StockMovementRequest,
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
const { attachUserName, USER_NAME_SELECT } = require("../../../utils/userName");

const manageAttendanceService = new ManageAttendanceService();

/**
 * 1. searchProducts
 */
async function searchProducts(tenantId, query) {
  const page = query?.page || 1;
  const limit = query?.limit || 10;
  return await ProductService.getProducts(tenantId, { ...query, page, limit });
}

/**
 * 2. getProductStockLevel
 */
async function getProductStockLevel(tenantId, { productId }) {
  return await ProductService.getProductById(tenantId, productId);
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
  return await CustomerService.getCustomerById(tenantId, customerId);
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
  return await manageAttendanceService.getAttendances(tenantId, {
    ...query,
    page,
    recordPerPage,
  });
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
 * 20. getOrderDetailsByCode (Nâng cấp & Sửa đổi ở hàm import)
 */
async function getOrderDetailsByCode(tenantId, { orderCode }) {
  if (!orderCode) {
    throw new Error("orderCode is required");
  }
  // Check if orderCode is a valid MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(orderCode)) {
    return await OrderService.getOrderById(tenantId, orderCode);
  }
  
  // Otherwise query by paymentReference
  const order = await Order.findOne({
    tenantId,
    $or: [
      { paymentReference: orderCode },
      { paymentReference: { $regex: new RegExp(`^${orderCode}$`, "i") } }
    ]
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
};
