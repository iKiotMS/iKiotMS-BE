const PayrollCycle = ["MONTHLY"];
const updatePayrollSettingFields = [
  "cycle",
  "periodStartDay",
  "approveAfterPeriodEndDays",
  "payAfterPeriodEndDays",
  "autoGenerate",
  "status",
];
const ALLOWED_EARLY_CHECKIN_MINUTES = 30;
const LATE_GRACE_MINUTES = 15;
module.exports = {
  PayrollCycle,
  updatePayrollSettingFields,
  ALLOWED_EARLY_CHECKIN_MINUTES,
  LATE_GRACE_MINUTES
};
