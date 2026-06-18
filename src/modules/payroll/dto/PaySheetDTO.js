const PAY_TYPES = [
  "PAY_BY_SHIFT",
  "PAY_BY_HOUR",
  "STANDARD_WORKING_DAY",
  "FIXED",
];
const BONUS_TYPES = [
  "EMPLOYEE_REVENUE",
  "MINIMUM_AVENUE_INCOME",
  "BRANCH_REVENUE",
];
const BONUS_CALCULATION_TYPES = [
  "GROSS_REVENUE",
  "NET_REVENUE",
  "COLLECTED_REVENUE",
];
const AMOUNT_TYPES = ["FIXED_AMOUNT", "PERCENTAGE"];
const ALLOWANCE_TYPES = ["FIXED_DAILY", "FIXED_MONTHLY"];
const DEDUCTION_TYPES = ["LATE", "EARLY_LEAVE", "FIXED"];
const DEDUCTION_CONDITION_TYPES = [
  "BY_OCCURRENCE",
  "BY_BLOCK",
  "BY_SALARY_COEFFICIENT",
];

const isNumber = (value) => {
  return typeof value === "number" && !Number.isNaN(value);
};
const isNonNegativeNumber = (value) => {
  return isNumber(value) && value >= 0;
};
const isPositiveNumber = (value) => {
  return isNumber(value) && value > 0;
};
const isValidPercentage = (value) => {
  return isNumber(value) && value >= 0 && value <= 100;
};

class PaySheetDTO {
  constructor(tenantId, data = {}) {
    data = data || {};

    this.tenantId = tenantId;
    this.name = data?.name?.trim();
    this.basicPay = this.mapBasicPay(data.basicPay);
    this.overtime = this.mapOvertime(data.overtime);
    this.bonuses = this.mapBonuses(data.bonuses);
    this.allowances = this.mapAllowances(data.allowances);
    this.deductions = this.mapDeductions(data.deductions);
  }

  mapBasicPay(basicPay = {}) {
    return {
      payType: basicPay?.payType,
      amountPerShift: basicPay?.amountPerShift,
      amountPerHour: basicPay?.amountPerHour,
      salaryPerPeriod: basicPay?.salaryPerPeriod,
      standardWorkingDays: basicPay?.standardWorkingDays,
      rates: {
        holiday: basicPay?.rates?.holiday ?? 1,
        specialHoliday: basicPay?.rates?.specialHoliday ?? 1,
      },
    };
  }

  mapOvertime(overtime = {}) {
    return {
      normalDay: overtime?.normalDay ?? 1.5,
      holiday: overtime?.holiday ?? 2,
      specialHoliday: overtime?.specialHoliday ?? 3,
    };
  }

  mapBonuses(bonuses) {
    if (bonuses !== undefined && !Array.isArray(bonuses)) {
      return null;
    }

    return Array.isArray(bonuses)
      ? bonuses.map((bonus) => ({
          bonusType: bonus.bonusType,
          calculationType: bonus.calculationType,
          enable: bonus.enable ?? false,
          tiers: Array.isArray(bonus.tiers)
            ? bonus.tiers.map((tier) => ({
                name: tier.name?.trim(),
                fromValue: tier.fromValue,
                rewardType: tier.rewardType,
                rewardValue: tier.rewardValue,
              }))
            : [],
        }))
      : [];
  }

  mapAllowances(allowances) {
    if (allowances !== undefined && !Array.isArray(allowances)) {
      return null;
    }

    return Array.isArray(allowances)
      ? allowances.map((allowance) => ({
          name: allowance.name?.trim(),
          enable: allowance.enable ?? false,
          allowancesType: allowance.allowancesType,
          amountType: allowance.amountType,
          amountValue: allowance.amountValue,
        }))
      : [];
  }

  mapDeductions(deductions) {
    if (deductions !== undefined && !Array.isArray(deductions)) {
      return null;
    }

    return Array.isArray(deductions)
      ? deductions.map((deduction) => ({
          name: deduction.name?.trim(),
          enable: deduction.enable ?? false,
          deductionType: deduction.deductionType,
          conditionType: deduction.conditionType,
          blockMinutes: deduction.blockMinutes,
          amountType: deduction.amountType,
          deductionValue: deduction.deductionValue,
        }))
      : [];
  }

  validateCreate() {
    const errors = [];

    if (!this.tenantId) {
      errors.push("Thiếu thông tin tenant");
    }

    if (!this.name) {
      errors.push("Tên bảng lương là bắt buộc");
    }

    if (!this.basicPay?.payType) {
      errors.push("Loại lương cơ bản là bắt buộc");
    } else if (!PAY_TYPES.includes(this.basicPay.payType)) {
      errors.push("Loại lương cơ bản không hợp lệ");
    }

    this.validateBasicPay(errors);
    this.validateOvertime(errors);
    this.validateBonuses(errors); // if no bonuses,the array is empty and the function will do zero loop iterations.
    this.validateAllowances(errors); // if no bonuses,the array is empty and the function will do zero loop iterations.
    this.validateDeductions(errors); // if no bonuses,the array is empty and the function will do zero loop iterations.

    const isValid = errors.length === 0;

    return {
      isValid,
      statusCode: isValid ? 200 : 400,
      errors,
    };
  }

  validateUpdate() {
    return this.validateCreate();
  }

  validateBasicPay(errors) {
    const {
      payType,
      amountPerShift,
      amountPerHour,
      salaryPerPeriod,
      standardWorkingDays,
      rates,
    } = this.basicPay;

    if (payType === "PAY_BY_SHIFT" && !isPositiveNumber(amountPerShift)) {
      errors.push("Lương mỗi ca phải lớn hơn 0");
    }

    if (payType === "PAY_BY_HOUR" && !isPositiveNumber(amountPerHour)) {
      errors.push("Lương mỗi giờ phải lớn hơn 0");
    }

    if (payType === "STANDARD_WORKING_DAY") {
      if (!isPositiveNumber(salaryPerPeriod)) {
        errors.push("Lương mỗi kỳ phải lớn hơn 0");
      }

      if (!isPositiveNumber(standardWorkingDays)) {
        errors.push("Số ngày công chuẩn phải lớn hơn 0");
      }
    }

    if (payType === "FIXED" && !isPositiveNumber(salaryPerPeriod)) {
      errors.push("Lương mỗi kỳ phải lớn hơn 0");
    }

    if (rates && !isPositiveNumber(rates.holiday)) {
      errors.push("Hệ số ngày nghỉ phải lớn hơn 0");
    }

    if (rates && !isPositiveNumber(rates.specialHoliday)) {
      errors.push("Hệ số ngày lễ tết phải lớn hơn 0");
    }
  }

  validateOvertime(errors) {
    if (!isPositiveNumber(this.overtime.normalDay)) {
      errors.push("Hệ số làm thêm ngày thường phải lớn hơn 0");
    }

    if (!isPositiveNumber(this.overtime.holiday)) {
      errors.push("Hệ số làm thêm ngày nghỉ phải lớn hơn 0");
    }

    if (!isPositiveNumber(this.overtime.specialHoliday)) {
      errors.push("Hệ số làm thêm ngày lễ tết phải lớn hơn 0");
    }
  }

  validateBonuses(errors) {
    if (!Array.isArray(this.bonuses)) {
      errors.push("Danh sách thưởng phải là một mảng");
      return;
    }

    this.bonuses.forEach((bonus, bonusIndex) => {
      const prefix = `Thưởng ${bonusIndex + 1}`;

      if (!BONUS_TYPES.includes(bonus.bonusType)) {
        errors.push(`${prefix}: loại thưởng không hợp lệ`);
      }

      if (!BONUS_CALCULATION_TYPES.includes(bonus.calculationType)) {
        errors.push(`${prefix}: hình thức tính thưởng không hợp lệ`);
      }

      if (!Array.isArray(bonus.tiers) || bonus.tiers.length === 0) {
        errors.push(`${prefix}: cần ít nhất một mức thưởng`);
      }

      bonus.tiers.forEach((tier, tierIndex) => {
        const tierPrefix = `${prefix}, mức ${tierIndex + 1}`;

        if (!isNonNegativeNumber(tier.fromValue)) {
          errors.push(`${tierPrefix}: giá trị bắt đầu phải là số không âm`);
        }

        if (!AMOUNT_TYPES.includes(tier.rewardType)) {
          errors.push(`${tierPrefix}: loại giá trị thưởng không hợp lệ`);
        }

        if (
          tier.rewardType === "PERCENTAGE" &&
          !isValidPercentage(tier.rewardValue)
        ) {
          errors.push(
            `${tierPrefix}: phần trăm thưởng phải nằm trong khoảng 0 đến 100`,
          );
        }

        if (
          tier.rewardType === "FIXED_AMOUNT" &&
          !isNonNegativeNumber(tier.rewardValue)
        ) {
          errors.push(`${tierPrefix}: giá trị thưởng phải là số không âm`);
        }
      });
    });
  }

  validateAllowances(errors) {
    if (!Array.isArray(this.allowances)) {
      errors.push("Danh sách phụ cấp phải là một mảng");
      return;
    }

    this.allowances.forEach((allowance, index) => {
      const prefix = `Phụ cấp ${index + 1}`;

      if (
        !allowance.name ||
        typeof allowance.name !== "string" ||
        !allowance.name.trim()
      ) {
        errors.push(`${prefix}: tên phụ cấp là bắt buộc`);
      }

      if (!ALLOWANCE_TYPES.includes(allowance.allowancesType)) {
        errors.push(`${prefix}: loại phụ cấp không hợp lệ`);
      }

      if (!AMOUNT_TYPES.includes(allowance.amountType)) {
        errors.push(`${prefix}: loại giá trị phụ cấp không hợp lệ`);
      }

      if (
        allowance.amountType === "PERCENTAGE" &&
        !isValidPercentage(allowance.amountValue)
      ) {
        errors.push(
          `${prefix}: phần trăm phụ cấp phải nằm trong khoảng 0 đến 100`,
        );
      }

      if (
        allowance.amountType === "FIXED_AMOUNT" &&
        !isNonNegativeNumber(allowance.amountValue)
      ) {
        errors.push(`${prefix}: giá trị phụ cấp phải là số không âm`);
      }
    });
  }

  validateDeductions(errors) {
    if (!Array.isArray(this.deductions)) {
      errors.push("Danh sách giảm trừ phải là một mảng");
      return;
    }

    this.deductions.forEach((deduction, index) => {
      const prefix = `Giảm trừ ${index + 1}`;

      if (
        !deduction.name ||
        typeof deduction.name !== "string" ||
        !deduction.name.trim()
      ) {
        errors.push(`${prefix}: tên giảm trừ là bắt buộc`);
      }

      if (!DEDUCTION_TYPES.includes(deduction.deductionType)) {
        errors.push(`${prefix}: loại giảm trừ không hợp lệ`);
      }

      if (["LATE", "EARLY_LEAVE"].includes(deduction.deductionType)) {
        if (!DEDUCTION_CONDITION_TYPES.includes(deduction.conditionType)) {
          errors.push(`${prefix}: điều kiện giảm trừ không hợp lệ`);
        }

        if (
          deduction.conditionType === "BY_BLOCK" &&
          !isPositiveNumber(deduction.blockMinutes)
        ) {
          errors.push(`${prefix}: số phút mỗi block phải lớn hơn 0`);
        }
      }

      if (!AMOUNT_TYPES.includes(deduction.amountType)) {
        errors.push(`${prefix}: loại giá trị giảm trừ không hợp lệ`);
      }

      if (
        deduction.amountType === "PERCENTAGE" &&
        !isValidPercentage(deduction.deductionValue)
      ) {
        errors.push(
          `${prefix}: phần trăm giảm trừ phải nằm trong khoảng 0 đến 100`,
        );
      }

      if (
        deduction.amountType === "FIXED_AMOUNT" &&
        !isNonNegativeNumber(deduction.deductionValue)
      ) {
        errors.push(`${prefix}: giá trị giảm trừ phải là số không âm`);
      }
    });
  }

  toObject() {
    return {
      tenantId: this.tenantId,
      name: this.name,
      basicPay: this.basicPay,
      overtime: this.overtime,
      bonuses: this.bonuses,
      allowances: this.allowances,
      deductions: this.deductions,
    };
  }
}

module.exports = { PaySheetDTO };
