const mongoose = require("mongoose");
const { Branch, CashDrawerSession, User } = require("../../../models");

function appError(message, statusCode, errors) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (errors) error.errors = errors;
  return error;
}

class CashDrawerService {
  businessDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  }

  ensureObjectId(value, field) {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw appError(`${field} is invalid`, 400, {
        [field]: `${field} is invalid`,
      });
    }
  }

  scopedBranchId(actor, requestedBranchId, required = true) {
    if (["BRANCH_MANAGER", "STAFF"].includes(actor.role)) {
      if (!actor.branchId) throw appError("User has no branch assigned", 403);
      if (
        requestedBranchId &&
        String(requestedBranchId) !== String(actor.branchId)
      ) {
        throw appError("You cannot access another branch's cash drawer", 403);
      }
      return actor.branchId;
    }
    if (required && !requestedBranchId) {
      throw appError("branchId is required", 400, {
        branchId: "branchId is required",
      });
    }
    return requestedBranchId;
  }

  async validateBranchAndStaff(tenantId, branchId, staffId) {
    this.ensureObjectId(branchId, "branchId");
    this.ensureObjectId(staffId, "staffId");
    const [branch, staff] = await Promise.all([
      Branch.findOne({ _id: branchId, tenantId, status: "ACTIVE" }).lean(),
      User.findOne({
        _id: staffId,
        tenantId,
        branchId,
        status: "ACTIVE",
        role: { $in: ["STAFF", "BRANCH_MANAGER"] },
      }).lean(),
    ]);
    if (!branch) throw appError("Active branch not found", 404);
    if (!staff) {
      throw appError("Active staff member was not found in this branch", 404);
    }
  }

  sessionScope(actor, sessionId) {
    this.ensureObjectId(sessionId, "sessionId");
    const filter = { _id: sessionId, tenantId: actor.tenantId };
    if (["BRANCH_MANAGER", "STAFF"].includes(actor.role)) {
      if (!actor.branchId) throw appError("User has no branch assigned", 403);
      filter.branchId = actor.branchId;
    }
    if (actor.role === "STAFF") {
      filter.$or = [
        { currentStaffId: actor.userId },
        { "shiftLogs.staffId": actor.userId },
      ];
    }
    return filter;
  }

  populateDetail(query) {
    return query
      .populate("branchId", "name")
      .populate(
        "openedBy finalLog.managerId",
        "profile.firstName profile.lastName phoneNumber",
      )
      .populate(
        "currentStaffId",
        "profile.firstName profile.lastName phoneNumber",
      )
      .populate(
        "shiftLogs.staffId",
        "profile.firstName profile.lastName phoneNumber",
      )
      .populate(
        "shiftLogs.nextStaffId",
        "profile.firstName profile.lastName phoneNumber",
      );
  }

  async open({ actor, dto }) {
    const branchId = this.scopedBranchId(actor, dto.branchId);
    await this.validateBranchAndStaff(actor.tenantId, branchId, dto.staffId);
    try {
      return await CashDrawerSession.create({
        tenantId: actor.tenantId,
        branchId,
        businessDate: this.businessDate(),
        openingAmount: dto.openingAmount,
        openedBy: actor.userId,
        currentStaffId: dto.staffId,
      });
    } catch (error) {
      if (error.code === 11000) {
        throw appError("A cash drawer session already exists for this branch", 409);
      }
      throw error;
    }
  }

  async current({ actor, branchId }) {
    const scopedBranchId = this.scopedBranchId(actor, branchId);
    this.ensureObjectId(scopedBranchId, "branchId");
    const drawer = await this.populateDetail(
      CashDrawerSession.findOne({
        tenantId: actor.tenantId,
        branchId: scopedBranchId,
        status: "OPEN",
        ...(actor.role === "STAFF"
          ? { currentStaffId: actor.userId }
          : {}),
      }),
    ).lean();
    if (!drawer) throw appError("No open cash drawer session found", 404);
    return drawer;
  }

  async detail({ actor, sessionId }) {
    const drawer = await this.populateDetail(
      CashDrawerSession.findOne(this.sessionScope(actor, sessionId)),
    ).lean();
    if (!drawer) throw appError("Cash drawer session not found", 404);
    return drawer;
  }

  async list({ actor, dto }) {
    const branchId = this.scopedBranchId(actor, dto.branchId, false);
    const filter = { tenantId: actor.tenantId };
    if (branchId) {
      this.ensureObjectId(branchId, "branchId");
      filter.branchId = branchId;
    }
    if (dto.status) filter.status = dto.status;
    if (actor.role === "STAFF") {
      filter.$or = [
        { currentStaffId: actor.userId },
        { "shiftLogs.staffId": actor.userId },
      ];
    }
    if (dto.fromDate || dto.toDate) {
      filter.businessDate = {};
      if (dto.fromDate) filter.businessDate.$gte = dto.fromDate;
      if (dto.toDate) filter.businessDate.$lte = dto.toDate;
    }

    const skip = (dto.page - 1) * dto.limit;
    const [data, total] = await Promise.all([
      CashDrawerSession.find(filter)
        .select("-shiftLogs")
        .sort({ businessDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(dto.limit)
        .populate("branchId", "name")
        .populate(
          "openedBy finalLog.managerId currentStaffId",
          "profile.firstName profile.lastName phoneNumber",
        )
        .lean(),
      CashDrawerSession.countDocuments(filter),
    ]);
    return {
      data,
      pagination: {
        total,
        page: dto.page,
        limit: dto.limit,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }

  async submitShiftLog({ actor, sessionId, dto }) {
    const drawer = await CashDrawerSession.findOne({
      ...this.sessionScope(actor, sessionId),
      status: "OPEN",
    });
    if (!drawer) throw appError("Open cash drawer session not found", 404);
    if (String(drawer.currentStaffId) !== String(actor.userId)) {
      throw appError("Only the current staff member can submit a shift log", 403);
    }
    if (dto.nextStaffId) {
      if (String(dto.nextStaffId) === String(actor.userId)) {
        throw appError("nextStaffId must be another user", 400);
      }
      await this.validateBranchAndStaff(
        actor.tenantId,
        drawer.branchId,
        dto.nextStaffId,
      );
    }

    const update = {
      $push: {
        shiftLogs: {
          staffId: actor.userId,
          amount: dto.amount,
          nextStaffId: dto.nextStaffId,
          note: dto.note?.trim(),
          loggedAt: new Date(),
        },
      },
      ...(dto.nextStaffId
        ? { $set: { currentStaffId: dto.nextStaffId } }
        : {}),
    };
    const updated = await CashDrawerSession.findOneAndUpdate(
      {
        _id: drawer._id,
        tenantId: actor.tenantId,
        status: "OPEN",
        currentStaffId: actor.userId,
        updatedAt: drawer.updatedAt,
      },
      update,
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw appError("Cash drawer changed concurrently; refresh and try again", 409);
    }
    return updated;
  }

  async finalize({ actor, sessionId, dto }) {
    const drawer = await CashDrawerSession.findOne({
      ...this.sessionScope(actor, sessionId),
      status: "OPEN",
    });
    if (!drawer) throw appError("Open cash drawer session not found", 404);

    const lastLog = drawer.shiftLogs.at(-1);
    if (
      !lastLog ||
      String(lastLog.staffId) !== String(drawer.currentStaffId) ||
      lastLog.nextStaffId
    ) {
      throw appError(
        "The current staff member must submit the final shift log before finalization",
        409,
      );
    }

    const updated = await CashDrawerSession.findOneAndUpdate(
      {
        _id: drawer._id,
        tenantId: actor.tenantId,
        status: "OPEN",
        updatedAt: drawer.updatedAt,
      },
      {
        $set: {
          status: "CLOSED",
          finalLog: {
            amount: dto.finalAmount,
            managerId: actor.userId,
            note: dto.note?.trim(),
          },
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw appError("Cash drawer changed concurrently; refresh and try again", 409);
    }
    return updated;
  }
}

module.exports = new CashDrawerService();
