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

function getLateMinutes(attendance, schedule, lateGraceMinutes = 15) {
  if (schedule.scheduleType !== "NORMAL") {
    return 0;
  }

  if (!attendance?.actualCheckinAt) {
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

  // IGNORE_WITHIN_GRACE: bỏ qua nếu nằm trong grace; khi vượt grace thì tính
  // toàn bộ số phút đi muộn. Ví dụ grace 15, đi muộn 20 => tính đủ 20 phút.
  return rawLateMinutes <= lateGraceMinutes ? 0 : rawLateMinutes;
}

function getScheduleAttendanceStatus(attendance) {
  if (!attendance) {
    return "NOT_CHECKED_IN";
  }

  return attendance.status || "NOT_CHECKED_IN";
}

function buildAttendanceSummary(attendance, schedule, lateGraceMinutes) {
  if (!attendance) {
    return {
      sourceScheduleId: null,
      status: "NOT_CHECKED_IN",
      actualCheckinAt: null,
      actualCheckoutAt: null,
      workedMinutesInThisSchedule: 0,
      lateMinutes: null,
    };
  }

  return {
    _id: attendance._id,
    sourceScheduleId: attendance.scheduleId,
    status: getScheduleAttendanceStatus(attendance),
    actualCheckinAt: attendance.actualCheckinAt || null,
    actualCheckoutAt: attendance.actualCheckoutAt || null,
    workedMinutesInThisSchedule: getWorkedMinutesInSchedule(
      attendance,
      schedule,
    ),
    lateMinutes: getLateMinutes(attendance, schedule, lateGraceMinutes),
  };
}

function buildAttendanceDetail(attendance, schedule, lateGraceMinutes) {
  if (!attendance) {
    return {
      sourceScheduleId: null,
      status: "NOT_CHECKED_IN",
      actualCheckinAt: null,
      actualCheckoutAt: null,
      workedMinutesInThisSchedule: 0,
      lateMinutes: null,
    };
  }

  return {
    _id: attendance._id,
    sourceScheduleId: attendance.scheduleId,
    status: getScheduleAttendanceStatus(attendance),
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
    lateMinutes: getLateMinutes(attendance, schedule, lateGraceMinutes),
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

function findScheduleAttendance(schedule, userId, attendanceByScheduleAndUser) {
  return (
    attendanceByScheduleAndUser[getAttendanceKey(schedule._id, userId)] || null
  );
}

function attachAttendancesToUsers(
  schedules,
  attendanceByScheduleAndUser,
  detail,
  lateGraceMinutes = 15,
) {
  return schedules.map((schedule) => {
    const users = getScheduleUsers(schedule);
    const usersWithAttendance = users.map((user) => {
      const userId = getUserIdText(user);
      const attendance = findScheduleAttendance(
        schedule,
        userId,
        attendanceByScheduleAndUser,
      );

      if (typeof user === "object" && user !== null) {
        return {
          ...user,
          attendance: detail
            ? buildAttendanceDetail(attendance, schedule, lateGraceMinutes)
            : buildAttendanceSummary(attendance, schedule, lateGraceMinutes),
        };
      }

      return {
        _id: user,
        attendance: detail
          ? buildAttendanceDetail(attendance, schedule, lateGraceMinutes)
          : buildAttendanceSummary(attendance, schedule, lateGraceMinutes),
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

function getScheduleValueId(value) {
  return String(value?._id || value || "");
}

function getScheduleTimeValue(value) {
  if (!value) return "";

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? String(value) : String(timestamp);
}

function getDuplicateScheduleKey(schedule) {
  const statusGroup =
    schedule.status === "CANCELLED" ? "CANCELLED" : "ACTIVE";

  return [
    getScheduleValueId(schedule.tenantId),
    schedule.scheduleType || "NORMAL",
    getScheduleValueId(schedule.shiftTemplateId),
    getScheduleTimeValue(schedule.workDate),
    getScheduleTimeValue(schedule.startAt),
    getScheduleTimeValue(schedule.endAt),
    statusGroup,
  ].join(":");
}

function hasAttendance(user) {
  const attendance = user?.attendance;
  return Boolean(
    attendance?._id ||
      (attendance?.status && attendance.status !== "NOT_CHECKED_IN"),
  );
}

function getScheduleCreatedTime(schedule) {
  const createdAt = new Date(schedule.createdAt || 0).getTime();
  return Number.isNaN(createdAt) ? 0 : createdAt;
}

function compareSchedulesForCanonical(left, right) {
  const leftHasAttendance = getScheduleUsers(left).some(hasAttendance);
  const rightHasAttendance = getScheduleUsers(right).some(hasAttendance);

  if (leftHasAttendance !== rightHasAttendance) {
    return leftHasAttendance ? -1 : 1;
  }

  const createdAtDifference =
    getScheduleCreatedTime(left) - getScheduleCreatedTime(right);
  if (createdAtDifference !== 0) {
    return createdAtDifference;
  }

  return getScheduleValueId(left._id).localeCompare(
    getScheduleValueId(right._id),
  );
}

/**
 * Dữ liệu cũ có thể chứa nhiều WorkingSchedule giống hệt nhau. Hàm này chỉ
 * chuẩn hóa response, không sửa DB. Mỗi khung giờ chỉ được trả một lần và
 * attendance thật được ưu tiên hơn trạng thái NOT_CHECKED_IN tổng hợp.
 */
function deduplicateWorkingSchedules(schedules) {
  const groups = new Map();

  schedules.forEach((schedule) => {
    const key = getDuplicateScheduleKey(schedule);
    const group = groups.get(key) || [];
    group.push(schedule);
    groups.set(key, group);
  });

  return Array.from(groups.values()).map((group) => {
    const orderedSchedules = [...group].sort(compareSchedulesForCanonical);
    const canonicalSchedule = orderedSchedules[0];
    const selectedUsers = new Map();
    const attendanceCountByUser = new Map();

    orderedSchedules.forEach((schedule) => {
      getScheduleUsers(schedule).forEach((user) => {
        const userId = getUserIdText(user);
        const currentUser = selectedUsers.get(userId);

        if (
          !currentUser ||
          (!hasAttendance(currentUser) && hasAttendance(user))
        ) {
          selectedUsers.set(userId, user);
        }

        if (hasAttendance(user)) {
          attendanceCountByUser.set(
            userId,
            (attendanceCountByUser.get(userId) || 0) + 1,
          );
        }
      });
    });

    const attendanceConflictUserIds = Array.from(
      attendanceCountByUser.entries(),
    )
      .filter(([, count]) => count > 1)
      .map(([userId]) => userId);
    const canonicalScheduleId = getScheduleValueId(canonicalSchedule._id);
    const duplicateScheduleIds = orderedSchedules
      .map((schedule) => getScheduleValueId(schedule._id))
      .filter((scheduleId) => scheduleId !== canonicalScheduleId);

    return {
      ...canonicalSchedule,
      userId: Array.from(selectedUsers.values()),
      dataIntegrity: {
        isDuplicate: duplicateScheduleIds.length > 0,
        duplicateCount: orderedSchedules.length,
        duplicateScheduleIds,
        attendanceConflict: attendanceConflictUserIds.length > 0,
        attendanceConflictUserIds,
      },
    };
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
  deduplicateWorkingSchedules,
};
