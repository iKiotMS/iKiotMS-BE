const Holiday = require("../../../models/Holiday");

const MINUTES_PER_HOUR = 60;

function getDateKey(dateValue) {
  return new Date(dateValue).toISOString().slice(0, 10);
}

function isWeekend(dateValue) {
  // Temporary payroll policy: only Sunday is considered a weekend day.
  return new Date(dateValue).getUTCDay() === 0;
}

function getDayType(workDate, holiday) {
  const weekend = isWeekend(workDate);
  const publicHoliday = holiday?.type === "PUBLIC_HOLIDAY";

  if (weekend && publicHoliday) return "WEEKEND_HOLIDAY";
  if (weekend) return "WEEKEND";
  if (publicHoliday) return "HOLIDAY";
  return "NORMAL";
}

function getHolidayRateType(dayType, holiday) {
  if (holiday?.type === "PUBLIC_HOLIDAY") {
    return "publicHoliday";
  }

  if (dayType === "WEEKEND") {
    return "weekend";
  }

  return null;
}

function getBasePayRate(paySheet, dayType, holiday) {
  const rateType = getHolidayRateType(dayType, holiday);

  if (!rateType) {
    return 1;
  }

  const rates = paySheet.basicPay?.rates || {};
  const legacyRate =
    rateType === "weekend"
      ? rates.sunday ?? rates.holiday
      : rates.specialHoliday;
  const defaultRates = {
    weekend: 2,
    publicHoliday: 3,
  };

  return rates[rateType] ?? legacyRate ?? defaultRates[rateType] ?? 1;
}

function getOvertimePayRate(paySheet, dayType, holiday) {
  const rateType = getHolidayRateType(dayType, holiday);

  if (!rateType) {
    return paySheet.overtime?.normalDay || 1.5;
  }

  const overtime = paySheet.overtime || {};
  const legacyRate =
    rateType === "weekend"
      ? overtime.sunday ?? overtime.holiday
      : overtime.specialHoliday;
  const defaultRates = {
    weekend: 2,
    publicHoliday: 3,
  };

  return overtime[rateType] ?? legacyRate ?? defaultRates[rateType] ?? 1.5;
}

function getScheduleMinutes(schedule) {
  if (!schedule.startAt || !schedule.endAt) {
    return 0;
  }

  const start = new Date(schedule.startAt).getTime();
  const end = new Date(schedule.endAt).getTime();

  if (end <= start) {
    return 0;
  }

  return Math.floor((end - start) / 60000);
}

function calculateSchedulePay({ schedule, paySheet, holiday }) {
  const basicPay = paySheet.basicPay || {};
  // Company holidays are intentionally excluded from the shared payroll policy.
  const payrollHoliday =
    holiday?.type === "PUBLIC_HOLIDAY" ? holiday : null;
  const dayType = getDayType(schedule.workDate, payrollHoliday);

  // Tổng số phút theo lịch của ca = (endAt - startAt) / 60s * 1000.
  // Ví dụ ca 08:00-17:00 có scheduleMinutes = 540 phút.
  const scheduleMinutes = getScheduleMinutes(schedule);

  // Số phút thực tế được tính lương: PayrollService tính tổng thời gian giao nhau
  // giữa các lần check-in/check-out và khung giờ của ca. Ép về Number và chặn
  // tối thiểu ở 0 để dữ liệu thiếu, sai kiểu hoặc âm không làm tiền lương bị âm.
  const payableMinutes = Math.max(0, Number(schedule.payableMinutes || 0));

  // Tỷ lệ hoàn thành ca, dùng để phân bổ lương theo ca/ngày.
  // Ví dụ làm 360/480 phút thì được tính 0,75 mức lương của ca/ngày đó.
  const workedRatio = scheduleMinutes ? payableMinutes / scheduleMinutes : 0;

  if (schedule.scheduleType === "OVERTIME") {
    const hourlyAmount =
      basicPay.amountPerHour ||
      (basicPay.amountPerShift && scheduleMinutes
        ? basicPay.amountPerShift / (scheduleMinutes / MINUTES_PER_HOUR)
        : 0);
    const rate = getOvertimePayRate(paySheet, dayType, payrollHoliday);

    return {
      scheduleId: schedule._id,
      scheduleType: schedule.scheduleType,
      dayType,
      rate,
      scheduledMinutes: scheduleMinutes,
      payableMinutes,
      amount: (payableMinutes / MINUTES_PER_HOUR) * hourlyAmount * rate,
      holidayName: payrollHoliday?.name || null,
    };
  }

  const rate = getBasePayRate(paySheet, dayType, payrollHoliday);
  let baseAmount = 0;

  if (basicPay.payType === "PAY_BY_HOUR") {
    baseAmount =
      (payableMinutes / MINUTES_PER_HOUR) * (basicPay.amountPerHour || 0);
  } else if (basicPay.payType === "PAY_BY_SHIFT") {
    baseAmount = (basicPay.amountPerShift || 0) * workedRatio;
  } else if (basicPay.payType === "STANDARD_WORKING_DAY") {
    const standardWorkingDays = basicPay.standardWorkingDays || 1;
    const amountPerDay = (basicPay.salaryPerPeriod || 0) / standardWorkingDays;
    baseAmount = amountPerDay * workedRatio;
  }

  return {
    scheduleId: schedule._id,
    scheduleType: schedule.scheduleType,
    dayType,
    rate,
    scheduledMinutes: scheduleMinutes,
    payableMinutes,
    amount: baseAmount * rate,
    holidayName: payrollHoliday?.name || null,
  };
}

async function getHolidayByDate({ tenantId, periodStart, periodEnd }) {
  const holidays = await Holiday.find({
    tenantId,
    isActive: true,
    date: {
      $gte: periodStart,
      $lte: periodEnd,
    },
  }).lean();

  return holidays.reduce((result, holiday) => {
    result[getDateKey(holiday.date)] = holiday;
    return result;
  }, {});

  /**
  holidayByDate = {
  "2026-01-01": {
    _id: ObjectId("..."),
    name: "Tết Dương lịch",
    date: new Date("2026-01-01"),
    type: "SPECIAL_HOLIDAY",
    isActive: true,
  },

  "2026-04-30": {
    _id: ObjectId("..."),
    name: "Ngày Giải phóng miền Nam",
    date: new Date("2026-04-30"),
    type: "SPECIAL_HOLIDAY",
    isActive: true,
  }, 
  */
}

function calculatePayrollBySchedules({ schedules, paySheet, holidayByDate }) {
  // Fixed salary belongs to the whole payroll period, so add it once here.
  // Normal schedules are still kept as lines for worked-time reporting.
  const fixedSalary =
    paySheet.basicPay?.payType === "FIXED"
      ? paySheet.basicPay.salaryPerPeriod || 0
      : 0;

  return schedules.reduce(
    (result, schedule) => {
      const holiday = holidayByDate[getDateKey(schedule.workDate)] || null;
      const line = calculateSchedulePay({ schedule, paySheet, holiday });

      result.lines.push(line);

      if (line.scheduleType === "OVERTIME") {
        result.overtimePay += line.amount;
      } else {
        result.basePay += line.amount;
      }

      result.grossPay = result.basePay + result.overtimePay;
      return result;
    },
    {
      basePay: fixedSalary,
      overtimePay: 0,
      grossPay: fixedSalary,
      lines: [],
    },
  );
}

module.exports = {
  calculatePayrollBySchedules,
  calculateSchedulePay,
  getHolidayByDate,
  getDayType,
  getBasePayRate,
  getOvertimePayRate,
};
