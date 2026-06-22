const { ShiftTemplateDTO } = require("../dto/ShiftTemplateDTO");
const ShiftTemplate = require("../../../models/ShiftTemplate");

class ShiftTemplateService {
  // Chuẩn hóa page/recordPerPage và tính số record cần bỏ qua.
  getPagination({ page = 1, recordPerPage = 10 } = {}) {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.max(parseInt(recordPerPage, 10) || 10, 1);

    return {
      page: pageNumber,
      recordPerPage: perPage,
      skip: (pageNumber - 1) * perPage,
    };
  }

  // Tạo ca mẫu, ví dụ: "Ca hành chính" 08:00 - 17:00.
  async createShiftTemplate(tenantId, data) {
    const dto = new ShiftTemplateDTO(tenantId, data);
    const validation = dto.validate();

    if (!validation.isValid) {
      const error = new Error(validation.errors.join("; "));
      error.statusCode = validation.statusCode;
      throw error;
    }

    const shiftTemplate = await ShiftTemplate.create(dto.toObject());

    // Data mẫu trả về:
    // {
    //   message: "Tạo ca mẫu thành công",
    //   data: { _id: "...", name: "Ca hành chính", startTime: "08:00", endTime: "17:00" }
    // }
    return {
      message: "Tạo ca mẫu thành công",
      data: shiftTemplate,
    };
  }

  // Lấy danh sách ca mẫu trong tenant hiện tại, có phân trang và lọc theo tên.
  async getShiftTemplateList(tenantId, { page, recordPerPage, name } = {}) {
    if (!tenantId) {
      const error = new Error("Thiếu thông tin tenant");
      error.statusCode = 400;
      throw error;
    }

    const pagination = this.getPagination({ page, recordPerPage });
    const filter = {
      tenantId,
      status: "ACTIVE",
    };

    if (name && String(name).trim()) {
      filter.name = new RegExp(String(name).trim(), "i");
    }

    const [data, total] = await Promise.all([
      ShiftTemplate.find(filter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.recordPerPage),
      ShiftTemplate.countDocuments(filter),
    ]);

    // Data mẫu trả về:
    // {
    //   data: [{ _id: "...", name: "Ca hành chính", startTime: "08:00", endTime: "17:00" }],
    //   pagination: { total: 20, page: 1, recordPerPage: 10, totalPages: 2 }
    // }
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

  // Lấy chi tiết một ca mẫu theo id và tenant.
  async getShiftTemplateById(tenantId, shiftTemplateId) {
    const shiftTemplate = await ShiftTemplate.findOne({
      _id: shiftTemplateId,
      tenantId,
      status: "ACTIVE",
    });

    if (!shiftTemplate) {
      const error = new Error("Không tìm thấy ca mẫu");
      error.statusCode = 404;
      throw error;
    }

    // Data mẫu trả về:
    // {
    //   _id: "...",
    //   name: "Ca hành chính",
    //   startTime: "08:00",
    //   endTime: "17:00"
    // }
    return shiftTemplate;
  }

  // Cập nhật toàn bộ thông tin ca mẫu.
  async updateShiftTemplate(tenantId, shiftTemplateId, data) {
    const dto = new ShiftTemplateDTO(tenantId, data);
    const validation = dto.validate();

    if (!validation.isValid) {
      const error = new Error(validation.errors.join("; "));
      error.statusCode = validation.statusCode;
      throw error;
    }

    const { tenantId: _tenantId, ...updateData } = dto.toObject();

    const shiftTemplate = await ShiftTemplate.findOneAndUpdate(
      { _id: shiftTemplateId, tenantId, status: "ACTIVE" },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!shiftTemplate) {
      const error = new Error("Không tìm thấy ca mẫu");
      error.statusCode = 404;
      throw error;
    }

    // Data mẫu trả về:
    // {
    //   message: "Cập nhật ca mẫu thành công",
    //   data: { _id: "...", name: "Ca tối", startTime: "17:00", endTime: "22:00" }
    // }
    return {
      message: "Cập nhật ca mẫu thành công",
      data: shiftTemplate,
    };
  }

  // Soft delete ca mẫu khỏi tenant hiện tại.
  async deleteShiftTemplate(tenantId, shiftTemplateId) {
    const shiftTemplate = await ShiftTemplate.findOneAndUpdate(
      {
        _id: shiftTemplateId,
        tenantId,
        status: "ACTIVE",
      },
      {
        $set: {
          status: "DELETED",
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!shiftTemplate) {
      const error = new Error("Không tìm thấy ca mẫu");
      error.statusCode = 404;
      throw error;
    }

    // Data mẫu trả về:
    // {
    //   message: "Xóa ca mẫu thành công",
    //   data: { id: "665aaa1234567890abcdef12", status: "DELETED" }
    // }
    return {
      message: "Xóa ca mẫu thành công",
      data: {
        id: shiftTemplate._id,
        status: shiftTemplate.status,
      },
    };
  }
}

module.exports = new ShiftTemplateService();
