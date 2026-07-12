const { CASHFLOW_PREFIXES } = require("../../../constants/referencePrefix");

const DEFAULT_RANGE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const TZ_OFFSET = "+07:00";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseBoundary(raw, endOfDay) {
  if (typeof raw === "string" && DATE_ONLY.test(raw)) {
    return new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}${TZ_OFFSET}`);
  }
  return new Date(raw);
}

class StatsQueryDTO {
  constructor(query = {}) {
    this.rawFrom = query.fromDate;
    this.rawTo = query.toDate;
    this.branchId = query.branchId || undefined;
    this.groupBy = query.groupBy;
    this.flow = query.flow ? String(query.flow).toUpperCase() : undefined;
    this.flowType = query.flowType ? String(query.flowType).toUpperCase() : undefined;
    this.sortBy = query.sortBy;
    this.limit = query.limit;
    this.lowStockThreshold = query.lowStockThreshold;

    this.toDate = this.rawTo ? parseBoundary(this.rawTo, true) : new Date();
    this.fromDate = this.rawFrom
      ? parseBoundary(this.rawFrom, false)
      : new Date(this.toDate.getTime() - DEFAULT_RANGE_DAYS * MS_PER_DAY);

    this.limit = this.limit != null ? parseInt(this.limit, 10) : 10;
    this.lowStockThreshold =
      this.lowStockThreshold != null ? parseInt(this.lowStockThreshold, 10) : 10;
  }

  validate() {
    const errors = {};

    if (Number.isNaN(this.fromDate.getTime())) errors.fromDate = "Invalid fromDate";
    if (Number.isNaN(this.toDate.getTime())) errors.toDate = "Invalid toDate";
    if (!errors.fromDate && !errors.toDate && this.fromDate > this.toDate) {
      errors.fromDate = "fromDate must be before toDate";
    }

    if (this.groupBy && !["day", "month"].includes(this.groupBy)) {
      errors.groupBy = "Must be one of: day, month";
    }
    if (this.flowType && !["INCOME", "EXPENSE"].includes(this.flowType)) {
      errors.flowType = "Must be one of: INCOME, EXPENSE";
    }
    if (this.flow && !CASHFLOW_PREFIXES.includes(this.flow)) {
      errors.flow = `Must be one of: ${CASHFLOW_PREFIXES.join(", ")}`;
    }
    if (this.sortBy && !["quantity", "revenue"].includes(this.sortBy)) {
      errors.sortBy = "Must be one of: quantity, revenue";
    }
    if (Number.isNaN(this.limit) || this.limit < 1 || this.limit > 100) {
      errors.limit = "limit must be between 1 and 100";
    }
    if (Number.isNaN(this.lowStockThreshold) || this.lowStockThreshold < 0) {
      errors.lowStockThreshold = "lowStockThreshold must be >= 0";
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }
}

module.exports = StatsQueryDTO;
