const BaseService = require("../../../common/services/baseService");
const PaySheetModel = require("../../../models/Paysheet");
const { PaySheetDTO } = require("../dto/PaySheetDTO");

class PaySheetService extends BaseService {
  constructor() {
    super(PaySheetModel);
  }

  getPagination({ page = 1, recordPerPage = 10 } = {}) {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.max(parseInt(recordPerPage, 10) || 10, 1);

    return {
      page: pageNumber,
      recordPerPage: perPage,
      skip: (pageNumber - 1) * perPage,
    };
  }

  checkTenantId(tenantId) {
    if (!tenantId || tenantId === null || tenantId === undefined) {
      throw new Error("Tenant ID is required");
    }
  }

  buildPaySheetFilter(tenantId, requesterId, requesterRole, filters) {
    const filter = { tenantId };
    if (
      requesterRole === "BRANCH_MANAGER" ||
      requesterRole === "WAREHOUSE_MANAGER"
    ) {
      filter.createdBy = requesterId;
    }

    return { ...filters, ...filter };
  }

  async createPaySheet(tenantId, currentUserId, data) {
    const paySheet = new PaySheetDTO(tenantId, currentUserId, data);
    const validationResult = paySheet.validateCreate();

    if (!validationResult.isValid) {
      const error = new Error(validationResult.errors.join("; "));
      error.statusCode = validationResult.statusCode;
      throw error;
    }

    const paySheetData = await PaySheetModel.create(paySheet.toObject());
    return { message: "Tạo bảng lương thành công", data: paySheetData };
  }

  async updatePaySheet(paySheetId, tenantId, currentUserId, data) {
    if (!paySheetId) {
      const error = new Error("Thiếu mã bảng lương");
      error.statusCode = 400;
      throw error;
    }

    const paySheet = new PaySheetDTO(tenantId, currentUserId, data);
    const validationResult = paySheet.validateCreate();

    if (!validationResult.isValid) {
      const error = new Error(validationResult.errors.join("; "));
      error.statusCode = validationResult.statusCode;
      throw error;
    }

    const {
      tenantId: _tenantId,
      createdBy: _createdBy,
      ...updateData
    } = paySheet.toObject();

    const updatedPaySheet = await PaySheetModel.findOneAndUpdate(
      { _id: paySheetId, tenantId },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!updatedPaySheet) {
      const error = new Error("Không tìm thấy bảng lương");
      error.statusCode = 404;
      throw error;
    }

    return {
      message: "Cập nhật bảng lương thành công",
      data: updatedPaySheet,
    };
  }

  async getPaySheetList(
    tenantId,
    filters,
    page = 1,
    recordPerPage = 10,
    currentUserId,
    currentUserRole,
  ) {
    this.checkTenantId(tenantId);
    const pagination = this.getPagination({ page, recordPerPage });
    const filter = this.buildPaySheetFilter(
      tenantId,
      currentUserId,
      currentUserRole,
      filters,
    );

    const [data, total] = await Promise.all([
      PaySheetModel.find(filter)
        .skip(pagination.skip)
        .limit(pagination.recordPerPage)
        .sort({ createdAt: -1 }),
      PaySheetModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page: pagination.page,
        recordPerPage: pagination.recordPerPage,
        totalPages: Math.ceil(total / pagination.recordPerPage),
      },
    };
  }

  async getPaySheetById(paySheetId, tenantId) {
    this.checkTenantId(tenantId);
    const paySheet = await PaySheetModel.findOne({ _id: paySheetId, tenantId });

    if (!paySheet) {
      const error = new Error("Không tìm thấy bảng lương");
      error.statusCode = 404;
      throw error;
    }
    return paySheet;
  }
}

module.exports = new PaySheetService();
