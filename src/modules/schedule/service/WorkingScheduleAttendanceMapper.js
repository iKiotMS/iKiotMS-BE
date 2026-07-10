const { LATE_GRACE_MINUTES } = require("../../../constants/PayrollConstants");

function getDateText(dateValue) {
  return new Date(dateValue).toISOString().slice(0, 10);
}

function calculateOverlapMinutes(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) {
    return 0;
  }

  const start = Math.max(new Date(startA).getTime(), new Date(startB).getTime());
  const end = Math.min(new Date(endA).getTime(), new Date(endB).getTime());

  if (end <= start) {
    return 0;
  }

  return Math.floor((end - start) / (60 * 1000));
}

function attendanceOverlapsSchedule(attendance, schedule) {
  if (!attendance?.actualCheckinAt) {
    return false;
  }

  const checkinAt = new Date(attendance.actualCheckinAt);
  const checkoutAt = attendance.actualCheckoutAt
    ? new Date(attendance.actualCheckoutAt)
    : null;
  const scheduleStart = new Date(schedule.startAt);
  const scheduleEnd = new Date(schedule.endAt);

  if (!checkoutAt) {
    return checkinAt >= scheduleStart && checkinAt < scheduleEnd;
  }

  return checkinAt < scheduleEnd && checkoutAt > scheduleStart;
}

function getWorkedMinutesInSchedule(attendance, schedule) {
  if (!attendance?.actualCheckoutAt) {
    return 0;
  }

  return calculateOverlapMinutes(
    attendance.actualCheckinAt,
    attendance.actualCheckoutAt,
    schedule.startAt,
    schedule.endAt,
  );
}

function getLateMinutes(attendance, schedule) {
  if (schedule.scheduleType !== "NORMAL") {
    return 0;
  }

  if (!attendanceOverlapsSchedule(attendance, schedule)) {
    return null;
  }

  const rawLateMinutes = Math.max(
    0,
    Math.floor(
      (new Date(attendance.actualCheckinAt).getTime() -
        new Date(schedule.startAt).getTime()) /
        60000,
    ),
  );

  return rawLateMinutes <= LATE_GRACE_MINUTES ? 0 : rawLateMinutes;
}

function getScheduleAttendanceStatus(attendance, schedule) {
  if (!attendanceOverlapsSchedule(attendance, schedule)) {
    return "NOT_CHECKED_IN";
  }

  return attendance.status || "NOT_CHECKED_IN";
}

function buildAttendanceSummary(attendance, schedule) {
  if (!attendance || !attendanceOverlapsSchedule(attendance, schedule)) {
    return {
      status: "NOT_CHECKED_IN",
      actualCheckinAt: null,
      actualCheckoutAt: null,
      workedMinutesInThisSchedule: 0,
      lateMinutes: null,
    };
  }

  return {
    _id: attendance._id,
    status: getScheduleAttendanceStatus(attendance, schedule),
    actualCheckinAt: attendance.actualCheckinAt || null,
    actualCheckoutAt: attendance.actualCheckoutAt || null,
    workedMinutesInThisSchedule: getWorkedMinutesInSchedule(
      attendance,
      schedule,
    ),
    lateMinutes: getLateMinutes(attendance, schedule),
  };
}

function buildAttendanceDetail(attendance, schedule) {
  if (!attendance || !attendanceOverlapsSchedule(attendance, schedule)) {
    return {
      status: "NOT_CHECKED_IN",
      actualCheckinAt: null,
      actualCheckoutAt: null,
      workedMinutesInThisSchedule: 0,
      lateMinutes: null,
    };
  }

  return {
    _id: attendance._id,
    status: getScheduleAttendanceStatus(attendance, schedule),
    actualCheckinAt: attendance.actualCheckinAt || null,
    actualCheckoutAt: attendance.actualCheckoutAt || null,
    checkInLocation: attendance.checkInLocation || null,
    checkOutLocation: attendance.checkOutLocation || null,
    workedMinutes: attendance.workedMinutes,
    workedMinutesInThisSchedule: getWorkedMinutesInSchedule(
      attendance,
      schedule,
    ),
    overtimeMinute: attendance.overtimeMinute,
    lateMinutes: getLateMinutes(attendance, schedule),
  };
}

function getScheduleUsers(schedule) {
  if (Array.isArray(schedule.userId)) {
    return schedule.userId;
  }

  if (schedule.userId) {
    return [schedule.userId];
  }

  return [];
}

function getUserIdText(user) {
  return String(user?._id || user);
}

function getAttendanceKey(workDate, userId) {
  return `${getDateText(workDate)}:${String(userId)}`;
}

function findScheduleAttendance(schedule, userId, attendanceByUserAndWorkDate) {
  const attendances =
    attendanceByUserAndWorkDate[getAttendanceKey(schedule.workDate, userId)] ||
    [];

  return (
    attendances.find((attendance) => {
      return attendanceOverlapsSchedule(attendance, schedule);
    }) || null
  );
}

function attachAttendancesToUsers(
  schedules,
  attendanceByUserAndWorkDate,
  detail,
) {
  return schedules.map((schedule) => {
    const users = getScheduleUsers(schedule);
    const usersWithAttendance = users.map((user) => {
      const userId = getUserIdText(user);
      const attendance = findScheduleAttendance(
        schedule,
        userId,
        attendanceByUserAndWorkDate,
      );

      if (typeof user === "object" && user !== null) {
        return {
          ...user,
          attendance: detail
            ? buildAttendanceDetail(attendance, schedule)
            : buildAttendanceSummary(attendance, schedule),
        };
      }

      return {
        _id: user,
        attendance: detail
          ? buildAttendanceDetail(attendance, schedule)
          : buildAttendanceSummary(attendance, schedule),
      };
    });

    return {
      ...schedule,
      userId: Array.isArray(schedule.userId)
        ? usersWithAttendance
        : usersWithAttendance[0] || null,
    };
  });
}

function pickScheduleUser(schedule, userId) {
  const users = getScheduleUsers(schedule);
  return users.find((user) => {
    return getUserIdText(user) === String(userId);
  });
}

module.exports = {
  buildAttendanceSummary,
  buildAttendanceDetail,
  calculateOverlapMinutes,
  getLateMinutes,
  getScheduleUsers,
  getUserIdText,
  getAttendanceKey,
  attachAttendancesToUsers,
  pickScheduleUser,
};
