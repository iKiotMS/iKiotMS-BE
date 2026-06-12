const StaffService = require("../service/StaffService");

class StaffController {
  async create(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user.role;
      const data = req.body;

      const staff = await StaffService.createStaff({ tenantId, data, userRole });

      res.status(201).json(staff);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getStaffList(req, res) {
    try {
      const {
        page = 1,
        recordPerPage = 10,
        status,
        keyword,
        role,
        branchId,
        warehouseId,
      } = req.query;

      const result = await StaffService.getStaffList({
        tenantId: req.user.tenantId,
        requesterId: req.user.userId,
        requesterRole: req.user.role,
        requesterBranchId: req.user.branchId,
        requesterWarehouseId: req.user.warehouseId,
        branchId,
        warehouseId,
        page,
        recordPerPage,
        status,
        keyword,
        role,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateStaff(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const staffId = req.params.staffId;
      const data = req.body.data;

      const staff = await StaffService.updateStaff({ tenantId, staffId, data });
      const response = new StaffResponseDTO(staff.data);

      res.status(200).json({ message: staff.message, staff: response });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async deleteStaff(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const staffId = req.params.staffId;

      const result = await StaffService.deleteStaff({ tenantId, staffId });
      res.status(200).json({ message: result.message });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new StaffController();
