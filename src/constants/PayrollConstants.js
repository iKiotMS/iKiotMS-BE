const PayrollCycle = ["MONTHLY"];
const updatePayrollSettingFields = [
  "cycle",
  "periodStartDay",
  "approveAfterPeriodEndDays",
  "payAfterPeriodEndDays",
  "autoGenerate",
  "standardWorkingDays",
  "standardWorkingHoursPerDay",
  "weekendDays",
  "lateGraceMinutes",
  "status",
];
const ALLOWED_EARLY_CHECKIN_MINUTES = 30;
module.exports = {
  PayrollCycle,
  updatePayrollSettingFields,
  ALLOWED_EARLY_CHECKIN_MINUTES,
};
