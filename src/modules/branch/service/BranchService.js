const Branch = require("../../../models/Branch");
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
}

module.exports = new BranchService();
