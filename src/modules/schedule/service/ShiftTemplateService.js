const { ShiftTemplateDTO } = require("../dto/ShiftTemplateDTO");
const ShiftTemplate = require("../../../models/ShiftTemplate");

class ShiftTemplateService {
  getPagination({ page = 1, recordPerPage = 10 } = {}) {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.max(parseInt(recordPerPage, 10) || 10, 1);

    return {
      page: pageNumber,
      recordPerPage: perPage,
      skip: (pageNumber - 1) * perPage,
    };
  }

  throwValidationError(validation) {
    if (validation.isValid) return;

    const error = new Error(validation.errors.join("; "));
    error.statusCode = validation.statusCode;
    throw error;
  }

  async createShiftTemplate(tenantId, data) {
    const dto = new ShiftTemplateDTO(tenantId, data);
    this.throwValidationError(dto.validate());

    const shiftTemplate = await ShiftTemplate.create(dto.toObject());

    return {
      message: "Tạo ca mẫu thành công",
      data: shiftTemplate,
    };
  }

  async getShiftTemplateList(tenantId, { page, recordPerPage, name } = {}) {
    if (!tenantId) {
      const error = new Error("Thiếu thông tin tenant");
      error.statusCode = 400;
      throw error;
    }

    const pagination = this.getPagination({ page, recordPerPage });
    const filter = { tenantId };

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

  async getShiftTemplateById(tenantId, shiftTemplateId) {
    const shiftTemplate = await ShiftTemplate.findOne({
      _id: shiftTemplateId,
      tenantId,
    });

    if (!shiftTemplate) {
      const error = new Error("Không tìm thấy ca mẫu");
      error.statusCode = 404;
      throw error;
    }

    return shiftTemplate;
  }

  async updateShiftTemplate(tenantId, shiftTemplateId, data) {
    const dto = new ShiftTemplateDTO(tenantId, data);
    this.throwValidationError(dto.validate());

    const { tenantId: _tenantId, ...updateData } = dto.toObject();
    const shiftTemplate = await ShiftTemplate.findOneAndUpdate(
      { _id: shiftTemplateId, tenantId },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!shiftTemplate) {
      const error = new Error("Không tìm thấy ca mẫu");
      error.statusCode = 404;
      throw error;
    }

    return {
      message: "Cập nhật ca mẫu thành công",
      data: shiftTemplate,
    };
  }

  async deleteShiftTemplate(tenantId, shiftTemplateId) {
    const shiftTemplate = await ShiftTemplate.findOneAndDelete({
      _id: shiftTemplateId,
      tenantId,
    });

    if (!shiftTemplate) {
      const error = new Error("Không tìm thấy ca mẫu");
      error.statusCode = 404;
      throw error;
    }

    return {
      message: "Xóa ca mẫu thành công",
      data: {
        id: shiftTemplate._id,
      },
    };
  }
}

module.exports = new ShiftTemplateService();
