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

function compareScheduleAssignments(left, right) {
  const leftHasAttendance = hasAttendance(left.user);
  const rightHasAttendance = hasAttendance(right.user);

  if (leftHasAttendance !== rightHasAttendance) {
    return leftHasAttendance ? -1 : 1;
  }

  const createdAtDifference =
    getScheduleCreatedTime(left.schedule) -
    getScheduleCreatedTime(right.schedule);
  if (createdAtDifference !== 0) {
    return createdAtDifference;
  }

  return getScheduleValueId(left.schedule._id).localeCompare(
    getScheduleValueId(right.schedule._id),
  );
}

/**
 * Dữ liệu cũ có thể chứa nhiều WorkingSchedule giống hệt nhau. Hàm này chỉ
 * chuẩn hóa response, không sửa DB. Chỉ phân ca trùng của cùng một nhân viên
 * mới được gộp; hai nhân viên khác nhau làm cùng khung giờ vẫn là hai dữ liệu
 * hợp lệ. Attendance thật được ưu tiên hơn NOT_CHECKED_IN tổng hợp.
 */
function deduplicateWorkingSchedules(schedules) {
  const assignmentGroups = new Map();

  schedules.forEach((schedule) => {
    const scheduleKey = getDuplicateScheduleKey(schedule);

    getScheduleUsers(schedule).forEach((user) => {
      const userId = getUserIdText(user);
      const assignmentKey = `${scheduleKey}:${userId}`;
      const group = assignmentGroups.get(assignmentKey) || [];

      group.push({ schedule, user, userId });
      assignmentGroups.set(assignmentKey, group);
    });
  });

  const responseByScheduleId = new Map();
  const integrityByScheduleId = new Map();

  schedules.forEach((schedule) => {
    const scheduleId = getScheduleValueId(schedule._id);
    responseByScheduleId.set(scheduleId, {
      ...schedule,
      userId: [],
    });
    integrityByScheduleId.set(scheduleId, {
      duplicateScheduleIds: new Set(),
      duplicateUserIds: new Set(),
      attendanceConflictUserIds: new Set(),
    });
  });

  assignmentGroups.forEach((group) => {
    const orderedAssignments = [...group].sort(compareScheduleAssignments);
    const canonicalAssignment = orderedAssignments[0];
    const canonicalScheduleId = getScheduleValueId(
      canonicalAssignment.schedule._id,
    );
    const responseSchedule = responseByScheduleId.get(canonicalScheduleId);
    responseSchedule.userId.push(canonicalAssignment.user);

    const duplicateScheduleIds = [
      ...new Set(
        orderedAssignments
          .slice(1)
          .map(({ schedule }) => getScheduleValueId(schedule._id))
          .filter((scheduleId) => scheduleId !== canonicalScheduleId),
      ),
    ];

    if (!duplicateScheduleIds.length) {
      return;
    }

    const integrity = integrityByScheduleId.get(canonicalScheduleId);
    duplicateScheduleIds.forEach((scheduleId) => {
      integrity.duplicateScheduleIds.add(scheduleId);
    });
    integrity.duplicateUserIds.add(canonicalAssignment.userId);

    const attendanceCount = orderedAssignments.filter(({ user }) => {
      return hasAttendance(user);
    }).length;
    if (attendanceCount > 1) {
      integrity.attendanceConflictUserIds.add(canonicalAssignment.userId);
    }
  });

  return schedules
    .map((schedule) => {
      const scheduleId = getScheduleValueId(schedule._id);
      const responseSchedule = responseByScheduleId.get(scheduleId);

      if (!responseSchedule.userId.length) {
        return null;
      }

      const integrity = integrityByScheduleId.get(scheduleId);
      const duplicateScheduleIds = Array.from(
        integrity.duplicateScheduleIds,
      );
      const duplicateUserIds = Array.from(integrity.duplicateUserIds);
      const attendanceConflictUserIds = Array.from(
        integrity.attendanceConflictUserIds,
      );

      return {
        ...responseSchedule,
        dataIntegrity: {
          isDuplicate: duplicateScheduleIds.length > 0,
          duplicateCount: duplicateScheduleIds.length + 1,
          duplicateScheduleIds,
          duplicateUserIds,
          attendanceConflict: attendanceConflictUserIds.length > 0,
          attendanceConflictUserIds,
        },
      };
    })
    .filter(Boolean);
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
