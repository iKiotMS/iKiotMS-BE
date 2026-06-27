const { registerTemplateModule } = require("./template");
const { registerAuthModule } = require("./auth");
const { registerSubscriptionModule } = require("./subscription");
const { registerTenantModule } = require("./tenant");
const { registerStaffModule } = require("./staff");
const { registerUploadModule } = require("./upload");
const { registerProductModule } = require("./product");
const { registerBrandModule } = require("./brand");
const { registerCategoryModule } = require("./category");
const { registerBranchModule } = require("./branch");
const { registerPayrollModule } = require("./payroll");
const { registerWarehouseModule } = require("./warehouse");
const { registerScheduleModule } = require("./schedule");
const { registerInventoryModule } = require("./inventory");
const { registerOrderModule } = require("./order");
const { registerAttendanceModule } = require("./attendances");
const { registerLeaveRequestModule } = require("./leaveRequest");

function registerModules(app) {
  registerAuthModule(app);
  registerTemplateModule(app);
  registerSubscriptionModule(app);
  registerTenantModule(app);
  registerStaffModule(app);
  registerUploadModule(app);
  registerProductModule(app);
  registerBrandModule(app);
  registerCategoryModule(app);
  registerBranchModule(app);
  registerPayrollModule(app);
  registerWarehouseModule(app);
  registerScheduleModule(app);
  registerInventoryModule(app);
  registerOrderModule(app);
  registerAttendanceModule(app);
  registerLeaveRequestModule(app);
}

module.exports = { registerModules };
