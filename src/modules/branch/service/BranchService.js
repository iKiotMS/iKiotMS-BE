const Branch = require("../../../models/Branch");
const { User } = require("../../../models");
const { BRANCH_STATUS } = require("../../../constants/branchConstants");

class BranchService {
  async createBranch(tenantId, branchData, subscription) {
    // Check branch quota
    if (subscription) {
      const maxBranches = subscription.currentQuotaSnapshot.maxBranches;
      if (maxBranches > 0) {
        // -1 means unlimited
        const activeBranchCount = await Branch.countDocuments({
          tenantId,
          status: { $ne: BRANCH_STATUS.DELETED },
        });
        if (activeBranchCount >= maxBranches) {
          throw new Error(
            `Branch limit reached. Your plan allows ${maxBranches} branches. Current: ${activeBranchCount}`,
          );
        }
      }
    }

    const branch = new Branch({
      tenantId,
      name: branchData.name,
      phoneNumber: branchData.phoneNumber,
      address: branchData.address,
      email: branchData.email,
      attendanceTakingLocation: branchData.attendanceTakingLocation,
    });

    await branch.save();
    return branch;
  }

  async getBranches(tenantId, queryParams) {
    const { page, limit, search, status } = queryParams;
    const skip = (page - 1) * limit;

    const filter = { tenantId, status: { $ne: BRANCH_STATUS.DELETED } };

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (status) {
      filter.status = status;
    }

    const [data, total] = await Promise.all([
      Branch.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Branch.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBranchById(tenantId, branchId) {
    const branch = await Branch.findOne({ _id: branchId, tenantId }).lean();
    if (!branch) {
      throw new Error("Branch not found");
    }
    return branch;
  }

  async updateBranch(tenantId, branchId, updateData) {
    const branch = await Branch.findOneAndUpdate(
      { _id: branchId, tenantId },
      { $set: updateData },
      { new: true },
    );

    if (!branch) {
      throw new Error("Branch not found");
    }

    return branch;
  }

  async softDeleteBranch(tenantId, branchId) {
    const branch = await Branch.findOneAndUpdate(
      { _id: branchId, tenantId },
      { $set: { status: BRANCH_STATUS.DELETED } },
      { new: true },
    );

    if (!branch) {
      throw new Error("Branch not found");
    }

    return branch;
  }

  async assignBranchManager({ tenantId, branchId, staffId }) {
    const session = await User.startSession();

    try {
      let result;

      await session.withTransaction(async () => {
        const branch = await Branch.findOne({
          _id: branchId,
          tenantId,
          status: { $ne: BRANCH_STATUS.DELETED },
        }).session(session);

        if (!branch) {
          throw new Error("Branch not found");
        }

        const newManager = await User.findOne({
          _id: staffId,
          tenantId,
          branchId,
          role: "STAFF",
          status: "ACTIVE",
        }).session(session);

        if (!newManager) {
          throw new Error(
            "New branch manager must be an active staff member in the same branch",
          );
        }

        const currentManager = await User.findOne({
          tenantId,
          branchId,
          role: "BRANCH_MANAGER",
          status: { $ne: "DELETED" },
        }).session(session);

        if (currentManager) {
          currentManager.role = "STAFF";
          await currentManager.save({ session });
        }

        newManager.role = "BRANCH_MANAGER";
        newManager.branchId = branchId;
        newManager.warehouseId = null;
        await newManager.save({ session });

        const manager = await User.findById(newManager._id)
          .select("-password")
          .populate("branchId")
          .populate("warehouseId")
          .session(session)
          .lean();

        result = {
          branchId,
          manager,
        };
      });

      return result;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new BranchService();
