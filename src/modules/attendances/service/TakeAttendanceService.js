const {
  EARTH_RADIUS_IN_METERS,
  DISTANCE_VERIFICATION_STATUS,
} = require("../../../constants/geolocationConstants");
const { Attendance } = require("../../../models");
const WorkingSchedule = require("../../../models/WorkingSchedule");
const StaffService = require("../../staff/service/StaffService");
const { CheckoutDTO } = require("../dto/CheckoutDTO");
const { CheckinDTO } = require("../dto/CheckinDTO");
const {
  ALLOWED_EARLY_CHECKIN_MINUTES,
} = require("../../../constants/PayrollConstants");

class TakeAttendanceService {
  //===============================================================================
  //==================== Helper Functions ========================================
  //===============================================================================
  calculateDistanceInMeters = (lat1, lon1, lat2, lon2) => {
    // Calculate the straight-line distance between two points using the Haversine formula.
    // Latitude/longitude are angles on the Earth, so we first convert degrees to radians.
    // deltaLat and deltaLong are the differences between the two points.
    // The formula estimates the shortest distance over the Earth's surface.
    // Earth radius is in meters, so the final result is also in meters.
    // Example: result = 85 means the user is about 85 meters away from the branch/warehouse.

    const toRadians = (degree) => {
      return (degree * Math.PI) / 180;
    };

    const deltaLat = toRadians(lat2 - lat1);
    const deltaLong = toRadians(lon2 - lon1);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(deltaLong / 2) *
        Math.sin(deltaLong / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_IN_METERS * c;
  };

  getAttendanceTakingLocation(workplace) {
    const location = workplace?.attendanceTakingLocation;

    if (
      !location ||
      location.latitude === undefined ||
      location.latitude === null ||
      location.longitude === undefined ||
      location.longitude === null
    ) {
      const error = new Error("Địa điểm chấm công chưa được cấu hình");
      error.statusCode = 400;
      throw error;
    }

    return location;
  }

  verifyStatus(workplace, data) {
    const attendanceTakingLocation =
      this.getAttendanceTakingLocation(workplace);
    const targetLatitude = attendanceTakingLocation.latitude;
    const targetLongitude = attendanceTakingLocation.longitude;
    const allowedRadiusMeters =
      attendanceTakingLocation.allowedRadiusMeters || 100;
    const maxAccuracyMeters = attendanceTakingLocation.maxAccuracyMeters || 100;

    const distance = this.calculateDistanceInMeters(
      data.latitude,
      data.longitude,
      targetLatitude,
      targetLongitude,
    );

    if (data.accuracy > maxAccuracyMeters) {
      const error = new Error(
        `Độ chính xác của vị trí (${data.accuracy}m) không đủ để chấm công`,
      );
      error.statusCode = 422;
      error.errors = {
        verificationStatus: DISTANCE_VERIFICATION_STATUS.LOW_ACCURACY,
        accuracy: data.accuracy,
        maxAccuracyMeters,
        distance,
        allowedRadiusMeters,
      };
      throw error;
    }

    if (distance > allowedRadiusMeters) {
      const error = new Error("Bạn đang ở ngoài khu vực chấm công cho phép");
      error.statusCode = 403;
      error.errors = {
        verificationStatus: DISTANCE_VERIFICATION_STATUS.OUT_OF_RANGE,
        accuracy: data.accuracy,
        maxAccuracyMeters,
        distance,
        allowedRadiusMeters,
      };
      throw error;
    }

    return {
      verificationStatus: DISTANCE_VERIFICATION_STATUS.VERIFIED,
      distance,
      allowedRadiusMeters,
      maxAccuracyMeters,
    };
  }

  getCheckInOpenAt(schedule) {
    return new Date(
      new Date(schedule.startAt).getTime() -
        ALLOWED_EARLY_CHECKIN_MINUTES * 60 * 1000,
    );
  }

  checkDate(actualCheckinAt, schedule) {
    const checkInOpenAt = this.getCheckInOpenAt(schedule);

    if (actualCheckinAt < checkInOpenAt || actualCheckinAt >= schedule.endAt) {
      const error = new Error(
        "Nhân viên chỉ được check-in trong khoảng thời gian của ca làm và trước ca làm 30 phút",
      );
      error.statusCode = 422;
      error.errors = {
        actualCheckinAt,
        checkInOpenAt,
        scheduleStartAt: schedule.startAt,
        scheduleEndAt: schedule.endAt,
        allowedEarlyCheckinMinutes: ALLOWED_EARLY_CHECKIN_MINUTES,
      };
      throw error;
    }
  }

  //===============================================================================
  //==================== Main Services ===========================================
  //===============================================================================
  async checkIn(tenantId, userId, data) {
    let newAttendanceRecord = new CheckinDTO(tenantId, userId, data);
    const validation = newAttendanceRecord.validate();
    if (!validation.isValid) {
      const error = new Error("Dữ liệu không hợp lệ");
      error.statusCode = validation.statusCode;
      error.errors = validation.errors;
      throw error;
    }

    const schedule = await WorkingSchedule.findOne({
      _id: newAttendanceRecord.scheduleId,
      tenantId,
      userId,
      status: "SCHEDULED",
    });

    if (!schedule) {
      const error = new Error("Không tìm thấy ca làm việc để check-in");
      error.statusCode = 404;
      throw error;
    }
    this.checkDate(newAttendanceRecord.actualCheckinAt, schedule);

    const existingAttendance = await Attendance.findOne({
      tenantId,
      userId,
      scheduleId: schedule._id,
    });

    if (existingAttendance) {
      const error = new Error("Nhân viên đã điểm danh cho ca làm việc này");
      error.statusCode = 409;
      throw error;
    }

    const staffWorkplace = await StaffService.getStaffWorkplace({
      tenantId,
      staffId: userId,
    });

    const workplace = staffWorkplace?.workplace;
    const geoResult = this.verifyStatus(workplace, {
      latitude: newAttendanceRecord.checkInLocation.latitude,
      longitude: newAttendanceRecord.checkInLocation.longitude,
      accuracy: newAttendanceRecord.checkInLocation.accuracy,
    });

    let attendance;
    try {
      attendance = await Attendance.create({
        tenantId,
        userId,
        scheduleId: schedule._id,
        // workDate là ngày nghiệp vụ của ca, không được suy ra từ ngày UTC của
        // thời điểm check-in vì ca sáng sớm hoặc ca qua đêm sẽ bị lệch ngày.
        workDate: schedule.workDate,
        actualCheckinAt: newAttendanceRecord.actualCheckinAt,
        checkInLocation: {
          latitude: newAttendanceRecord.checkInLocation.latitude,
          longitude: newAttendanceRecord.checkInLocation.longitude,
          accuracy: newAttendanceRecord.checkInLocation.accuracy,
          distance: geoResult.distance,
          verificationStatus: geoResult.verificationStatus,
        },
        status: "CHECKED_IN",
      });
    } catch (error) {
      if (error.code === 11000) {
        const conflictError = new Error(
          "Nhân viên đã điểm danh cho ca làm việc này",
        );
        conflictError.statusCode = 409;
        throw conflictError;
      }
      throw error;
    }

    return {
      success: true,
      message: "Check-in thành công",
      data: {
        attendance,
        geo: geoResult,
      },
    };
  }

  async checkOut(tenantId, userId, data) {
    const checkoutRecord = new CheckoutDTO(tenantId, userId, data);
    const validation = checkoutRecord.validate();
    if (!validation.isValid) {
      const error = new Error("Dữ liệu không hợp lệ");
      error.statusCode = validation.statusCode;
      error.errors = validation.errors;
      throw error;
    }

    const attendance = await Attendance.findOne({
      _id: checkoutRecord.attendanceId,
      tenantId,
      userId,
    });

    if (!attendance) {
      const error = new Error("Attendance not found");
      error.statusCode = 404;
      throw error;
    }

    if (attendance.status !== "CHECKED_IN") {
      const error = new Error("Attendance is not in CHECKED_IN status");
      error.statusCode = 400;
      throw error;
    }

    const staffWorkplace = await StaffService.getStaffWorkplace({
      tenantId,
      staffId: userId,
    });

    const workplace = staffWorkplace?.workplace;
    const geoResult = this.verifyStatus(workplace, {
      latitude: checkoutRecord.checkOutLocation.latitude,
      longitude: checkoutRecord.checkOutLocation.longitude,
      accuracy: checkoutRecord.checkOutLocation.accuracy,
    });

    if (
      attendance.actualCheckinAt &&
      checkoutRecord.actualCheckoutAt < attendance.actualCheckinAt
    ) {
      const error = new Error("Thời gian check-out không thể trước check-in");
      error.statusCode = 422;
      throw error;
    }

    attendance.actualCheckoutAt = checkoutRecord.actualCheckoutAt;
    attendance.workedMinutes = attendance.actualCheckinAt
      ? Math.max(
          0,
          Math.floor(
            (checkoutRecord.actualCheckoutAt - attendance.actualCheckinAt) /
              60000,
          ),
        )
      : 0;
    attendance.checkOutLocation = {
      latitude: checkoutRecord.checkOutLocation.latitude,
      longitude: checkoutRecord.checkOutLocation.longitude,
      accuracy: checkoutRecord.checkOutLocation.accuracy,
      distance: geoResult.distance,
      verificationStatus: geoResult.verificationStatus,
    };
    attendance.status = "CHECKED_OUT";

    await attendance.save();

    return {
      success: true,
      message: "Check-out thành công",
      data: {
        attendance,
        geo: geoResult,
      },
    };
  }
}

module.exports = { TakeAttendanceService };
