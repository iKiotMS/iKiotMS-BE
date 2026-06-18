const PaySheetModel = require("../../../models/Paysheet");
const { PaySheetDTO } = require("../dto/PaySheetDTO");

class PaySheetService {
  async createPaySheet(tenantId, data) {
    const paySheet = new PaySheetDTO(tenantId, data);
    const validationResult = paySheet.validateCreate();

    if (!validationResult.isValid) {
      const error = new Error(validationResult.errors.join("; "));
      error.statusCode = validationResult.statusCode;
      throw error;
    }

    const paySheetData = await PaySheetModel.create(paySheet.toObject());
    return { message: "Tạo bảng lương thành công", data: paySheetData };
  }

  async updatePaySheet(paySheetId, tenantId, data) {
    if (!paySheetId) {
      const error = new Error("Thiếu mã bảng lương");
      error.statusCode = 400;
      throw error;
    }

    const paySheet = new PaySheetDTO(tenantId, data);
    const validationResult = paySheet.validateCreate();

    if (!validationResult.isValid) {
      const error = new Error(validationResult.errors.join("; "));
      error.statusCode = validationResult.statusCode;
      throw error;
    }

    const { tenantId: _tenantId, ...updateData } = paySheet.toObject();

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
}

module.exports = new PaySheetService();
