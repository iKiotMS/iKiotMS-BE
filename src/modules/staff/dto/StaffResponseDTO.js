class StaffResponseDTO {
    constructor(staff) {
        this.id = staff._id;
        this.name = staff.name;
        this.email = staff.email;
        this.phoneNumber = staff.phoneNumber;
        this.role = staff.role;
        this.status = staff.status;
        this.hireDate = staff.hireDate;
        this.paySheetId = staff.paySheetId;
        this.branch = staff.branchId;
        this.warehouse = staff.warehouseId;
        this.profile = staff.profile;
    }
}

module.exports = StaffResponseDTO;
