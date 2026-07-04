const StaffService = require("../service/StaffService");
const StaffResponseDTO = require("../dto/StaffResponseDTO");

class StaffController {
  getRequestData(req) {
    return req.body?.data || req.body || {};
  }

  async create(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const userRole = req.user.role;
      const data = req.body;
      const subscription = req.subscription;

      const staff = await StaffService.createStaff({
        tenantId,
        data,
        userRole,
        subscription,
      });

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
        userId: req.user.userId,
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
      const userRole = req.user.role;
      const staffId = req.params.staffId;
      const userId = req.user.userId;
      const data = this.getRequestData(req);

      const staff = await StaffService.updateStaff({
        tenantId,
        userId,
        staffId,
        data,
        userRole,
      });
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
      const userId = req.user.userId;
      const userRole = req.user.role;
      const data = this.getRequestData(req);

      const result = await StaffService.deleteStaff({
        tenantId,
        userId,
        userRole,
        staffId,
        replacementManagerId: data.replacementManagerId,
      });

      res.status(200).json({ message: result.message, staff: result.data });
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async createStaffAccount(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const staffId = req.params.staffId;
      const userId = req.user.userId;
      const data = this.getRequestData(req);

      const result = await StaffService.createStaffAccount({
        tenantId,
        userId,
        staffId,
        data,
      });
      const response = new StaffResponseDTO(result.data);

      res.status(201).json({ message: result.message, staff: response });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async updateStaffAccountPassword(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const staffId = req.params.staffId;
      const userId = req.user.userId;
      const data = this.getRequestData(req);

      const result = await StaffService.updateStaffAccountPassword({
        tenantId,
        userId,
        staffId,
        data,
      });
      const response = new StaffResponseDTO(result.data);

      res.status(200).json({ message: result.message, staff: response });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async deactivateStaffAccount(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const staffId = req.params.staffId;
      const userId = req.user.userId;
      const userRole = req.user.role;
      const data = this.getRequestData(req);

      const result = await StaffService.deactivateStaffAccount({
        tenantId,
        userId,
        userRole,
        staffId,
        replacementManagerId: data.replacementManagerId,
      });

      res.status(200).json({ message: result.message, staff: result.data });
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }
  }

  async getAvailableRoles(req, res) {
    try {
      const roles = StaffService.getAvailableStaffRoles(req.user.role);

      res.status(200).json({ data: roles });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new StaffController();
