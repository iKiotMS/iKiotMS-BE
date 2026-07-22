const PayrollCycle = ["MONTHLY"];
const updatePayrollSettingFields = [
  "cycle",
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
const ONE_HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
const ONE_DAY_IN_MILLISECONDS = 24 * ONE_HOUR_IN_MILLISECONDS;
const VIETNAM_UTC_OFFSET_IN_MILLISECONDS = 7 * ONE_HOUR_IN_MILLISECONDS;
module.exports = {
  PayrollCycle,
  updatePayrollSettingFields,
  ALLOWED_EARLY_CHECKIN_MINUTES,
  ONE_HOUR_IN_MILLISECONDS,
  ONE_DAY_IN_MILLISECONDS,
  VIETNAM_UTC_OFFSET_IN_MILLISECONDS,
};
