const mongoose = require("mongoose");
const WorkingSchedule = require("../models/WorkingSchedule");
const User = require("../models/User");

const TEMPORARY_PERMISSIONS = Object.freeze({
  cash_drawers: Object.freeze([
    "open",
    "read",
    "read_own",
    "finalize",
  ]),
  suppliers: Object.freeze(["read", "update", "delete"]),
  stock_movement: Object.freeze([
    "create",
    "read",
    "update",
    "approve",
    "receive",
    "cancel",
  ]),
});

const MANAGED_STOCK_MOVEMENT_TYPES = Object.freeze([
  "EXPORT",
  "ADJUST",
  "RETURN",
]);

class ManagedScheduleAccessService {
  supports(moduleName, action) {
    return Boolean(TEMPORARY_PERMISSIONS[moduleName]?.includes(action));
  }

  async resolve(user, moduleName, actions, now = new Date()) {
    if (user?.role !== "STAFF") return null;
    if (
      !mongoose.Types.ObjectId.isValid(user.tenantId) ||
      !mongoose.Types.ObjectId.isValid(user.userId)
    ) {
      return null;
    }

    const requestedActions = Array.isArray(actions) ? actions : [actions];
    if (!requestedActions.some((action) => this.supports(moduleName, action))) {
      return null;
    }

    let scheduleQuery = WorkingSchedule.find({
      tenantId: user.tenantId,
      managedBy: user.userId,
      status: "SCHEDULED",
      startAt: { $lte: now },
      endAt: { $gt: now },
    }).select("_id startAt endAt userId");

    if (moduleName !== "suppliers") {
      scheduleQuery = scheduleQuery.populate({
        path: "userId",
        select: "branchId warehouseId",
      });
    }

    const schedules = await scheduleQuery.lean();

    if (!schedules.length) return null;

    const branchIds = new Set();
    const warehouseIds = new Set();

    schedules.forEach((schedule) => {
      (schedule.userId || []).forEach((scheduledUser) => {
        if (scheduledUser?.branchId) {
          branchIds.add(String(scheduledUser.branchId));
        }
        if (scheduledUser?.warehouseId) {
          warehouseIds.add(String(scheduledUser.warehouseId));
        }
      });
    });

    if (moduleName !== "suppliers") {
      const managedStaff = await User.findOne({
        _id: user.userId,
        tenantId: user.tenantId,
        role: "STAFF",
        status: "ACTIVE",
      })
        .select("branchId warehouseId")
        .lean();

      if (!managedStaff) return null;

      const staffBranchId = managedStaff.branchId
        ? String(managedStaff.branchId)
        : null;
      const staffWarehouseId = managedStaff.warehouseId
        ? String(managedStaff.warehouseId)
        : null;

      [...branchIds].forEach((branchId) => {
        if (branchId !== staffBranchId) branchIds.delete(branchId);
      });
      [...warehouseIds].forEach((warehouseId) => {
        if (warehouseId !== staffWarehouseId) {
          warehouseIds.delete(warehouseId);
        }
      });
    }

    if (moduleName === "cash_drawers" && branchIds.size === 0) {
      return null;
    }
    if (
      moduleName === "stock_movement" &&
      branchIds.size === 0 &&
      warehouseIds.size === 0
    ) {
      return null;
    }

    return {
      temporary: true,
      scheduleIds: schedules.map((schedule) => String(schedule._id)),
      branchIds: [...branchIds],
      warehouseIds: [...warehouseIds],
      startsAt: new Date(
        Math.min(
          ...schedules.map((schedule) => new Date(schedule.startAt).getTime()),
        ),
      ),
      endsAt: new Date(
        Math.max(
          ...schedules.map((schedule) => new Date(schedule.endAt).getTime()),
        ),
      ),
    };
  }

  canAccessLocation(access, locationId, locationType) {
    if (!access?.temporary || !locationId) return false;

    const allowedIds =
      (locationType === "branch"
        ? access.branchIds
        : locationType === "warehouse"
          ? access.warehouseIds
          : []) || [];

    return allowedIds.some((id) => String(id) === String(locationId));
  }
}

module.exports = new ManagedScheduleAccessService();
module.exports.TEMPORARY_PERMISSIONS = TEMPORARY_PERMISSIONS;
module.exports.MANAGED_STOCK_MOVEMENT_TYPES = MANAGED_STOCK_MOVEMENT_TYPES;
