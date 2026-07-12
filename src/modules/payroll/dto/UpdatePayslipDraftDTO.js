const CATEGORIES = ["SALARY_ADVANCE", "TET_BONUS", "OTHER"];

class UpdatePayslipDraftDTO {
  constructor(data) {
    this.note = data.note;
    this.manualAdjustments = data.manualAdjustments;
  }

  validate() {
    const errors = {};

    if (this.note !== undefined && typeof this.note !== "string") {
      errors.note = "Ghi chú phải là chuỗi";
    }

    if (
      this.manualAdjustments !== undefined &&
      !Array.isArray(this.manualAdjustments)
    ) {
      errors.manualAdjustments = "Điều chỉnh thủ công phải là mảng";
    } else if (this.manualAdjustments) {
      this.manualAdjustments.forEach((item, index) => {
        if (!CATEGORIES.includes(item.category || "OTHER")) {
          errors[`manualAdjustments.${index}.category`] =
            "Loại điều chỉnh không hợp lệ";
        }
        if (!item.name || typeof item.name !== "string") {
          errors[`manualAdjustments.${index}.name`] =
            "Tên điều chỉnh là bắt buộc";
        }
        if (!Number.isFinite(Number(item.amount)) || Number(item.amount) === 0) {
          errors[`manualAdjustments.${index}.amount`] =
            "Số tiền điều chỉnh phải khác 0";
        }
        if (item.note !== undefined && typeof item.note !== "string") {
          errors[`manualAdjustments.${index}.note`] = "Ghi chú phải là chuỗi";
        }
      });
    }

    if (this.note === undefined && this.manualAdjustments === undefined) {
      errors.body = "Phải cung cấp note hoặc manualAdjustments";
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = UpdatePayslipDraftDTO;
