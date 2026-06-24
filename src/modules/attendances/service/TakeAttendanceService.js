const {
  EARTH_RADIUS_IN_METERS,
  DISTANCE_VERIFICATION_STATUS,
} = require("../../../constants/geolocationConstants");
const { Attendance } = require("../../../models");
const WorkingSchedule = require("../../../models/WorkingSchedule");
const StaffService = require("../../staff/service/StaffService");
const { AttendanceDTO } = require("../dto/AttendanceDTO");

class TakeAttendanceService {
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

  async checkIn(tenantId, userId, data) {
    let newAttendanceRecord = new AttendanceDTO(tenantId, userId, data);
    const validation = newAttendanceRecord.validate();
    if (!validation.isValid) {
      const error = new Error("Dữ liệu không hợp lệ");
      error.statusCode = validation.statusCode;
      error.errors = validation.errors;
      throw error;
    }

    const scheduleId = data.scheduleId;
    const schedule = await WorkingSchedule.findOne({
      _id: scheduleId,
      tenantId,
      userId,
      status: "SCHEDULED",
    });
    if (!schedule) {
      const error = new Error("Lịch làm việc không tồn tại");
      error.statusCode = 404;
      throw error;
    }

    const existingAttendance = await Attendance.findOne({
      tenantId,
      userId,
      scheduleId: schedule._id,
    });

    if (existingAttendance) {
      const error = new Error("Nhân viên đã check-in cho lịch làm việc này");
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

    const attendance = await Attendance.create({
      tenantId,
      userId,
      scheduleId: schedule._id,
      actualCheckinAt: new Date(),
      checkInLocation: {
        latitude: newAttendanceRecord.checkInLocation.latitude,
        longitude: newAttendanceRecord.checkInLocation.longitude,
        accuracy: newAttendanceRecord.checkInLocation.accuracy,
        distance: geoResult.distance,
        verificationStatus: geoResult.verificationStatus,
      },
      status: "CHECKED_IN",
    });

    return {
      success: true,
      message: "Check-in thành công",
      data: {
        attendance,
        geo: geoResult,
      },
    };
  }
}

module.exports = { TakeAttendanceService };
