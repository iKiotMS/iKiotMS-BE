const PayrollSetting = require("../../../models/PayrollSetting");
const createPayrollSettingDTO = require("../dto/CreatePayrollSettingDTO");
const updatePayrollSettingDTO = require("../dto/UpdatePayrollSettingDTO");

class PayrollSettingService {
  async getPayrollSetting(tenantId) {
    const payrollSetting = await PayrollSetting.findOne({ tenantId }).lean();

    if (!payrollSetting) {
      const error = new Error("Không tìm thấy cấu hình lương");
      error.statusCode = 404;
      throw error;
    }

    return {
      statusCode: 200,
      data: payrollSetting,
    };
  }

  async createPayrollSetting({ tenantId, payrollSettingData }) {
    const createDTO = new createPayrollSettingDTO(tenantId, payrollSettingData);
    const error = createDTO.validate();
    if (!error.isValid){
        throw error;
    }

    const existedSetting = await PayrollSetting.findOne({ tenantId }).lean();
    if (existedSetting) {
      const error = new Error("Cấu hình lương đã tồn tại");
      error.statusCode = 409;
      throw error;
    }
    const newSetting = await PayrollSetting.create(createDTO.toObject());
    return {
      message: "Cấu hình lương đã được tạo thành công",
      statusCode: 201,
      data: newSetting,
    };
  }

  async updatePayrollSetting({ tenantId, payrollSettingData }) {
    const updateDTO = new updatePayrollSettingDTO(payrollSettingData);
    const error = updateDTO.validate();
    if (!error.isValid) {
      throw error;
    }

    const updateData = updateDTO.toObject();
    if (Object.keys(updateData).length === 0) {
      const error = new Error("Không có dữ liệu cập nhật");
      error.statusCode = 400;
      throw error;
    }

    const setting = await PayrollSetting.findOneAndUpdate(
      { tenantId },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!setting) {
      const error = new Error("Không tìm thấy cấu hình lương");
      error.statusCode = 404;
      throw error;
    }

    return {
      message: "Cấu hình lương đã được cập nhật thành công",
      statusCode: 200,
      data: setting,
    };
  }
}

module.exports = new PayrollSettingService();
