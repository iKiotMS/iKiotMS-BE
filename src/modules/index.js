const { registerTemplateModule } = require("./template");
const { registerAuthModule } = require("./auth");
const { registerSubscriptionModule } = require("./subscription");
const { registerStaffModule } = require("./staff");
const { registerUploadModule } = require("./upload");
const { registerProductModule } = require("./product");
const { registerBranchModule } = require("./branch");
const { registerPayrollModule } = require("./payroll");
const { registerWarehouseModule } = require("./warehouse");
const { registerScheduleModule } = require("./schedule");
const { registerInventoryModule } = require("./inventory");

function registerModules(app) {
  registerAuthModule(app);
  registerTemplateModule(app);
  registerSubscriptionModule(app);
  registerStaffModule(app);
  registerUploadModule(app);
  registerProductModule(app);
  registerBranchModule(app);
  registerPayrollModule(app);
  registerWarehouseModule(app);
  registerScheduleModule(app);
  registerInventoryModule(app);
}

module.exports = { registerModules };
