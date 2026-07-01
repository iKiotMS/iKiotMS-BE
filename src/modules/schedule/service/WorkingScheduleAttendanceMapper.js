function buildAttendanceSummary(attendance) {
  if (!attendance) {
    return {
      status: "NOT_CHECKED_IN",
      actualCheckinAt: null,
      actualCheckoutAt: null,
    };
  }

  return {
    _id: attendance._id,
    status: attendance.status,
    actualCheckinAt: attendance.actualCheckinAt || null,
    actualCheckoutAt: attendance.actualCheckoutAt || null,
  };
}

function buildAttendanceDetail(attendance) {
  if (!attendance) {
    return {
      status: "NOT_CHECKED_IN",
      actualCheckinAt: null,
      actualCheckoutAt: null,
    };
  }

  return {
    _id: attendance._id,
    status: attendance.status,
    actualCheckinAt: attendance.actualCheckinAt || null,
    actualCheckoutAt: attendance.actualCheckoutAt || null,
    checkInLocation: attendance.checkInLocation || null,
    checkOutLocation: attendance.checkOutLocation || null,
    workedMinutes: attendance.workedMinutes,
    overtimeMinute: attendance.overtimeMinute,
    lateMinutes: attendance.lateMinutes,
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

function getAttendanceKey(scheduleId, userId) {
  return `${String(scheduleId)}:${String(userId)}`;
}

function attachAttendancesToUsers(schedules, attendanceByScheduleAndUser, detail) {
  return schedules.map((schedule) => {
    const users = getScheduleUsers(schedule);
    const usersWithAttendance = users.map((user) => {
      const userId = getUserIdText(user);
      const attendance =
        attendanceByScheduleAndUser[getAttendanceKey(schedule._id, userId)];

      if (typeof user === "object" && user !== null) {
        return {
          ...user,
          attendance: detail
            ? buildAttendanceDetail(attendance)
            : buildAttendanceSummary(attendance),
        };
      }

      return {
        _id: user,
        attendance: detail
          ? buildAttendanceDetail(attendance)
          : buildAttendanceSummary(attendance),
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
  getScheduleUsers,
  getUserIdText,
  getAttendanceKey,
  attachAttendancesToUsers,
  pickScheduleUser,
};
