const { registerTemplateModule } = require("./template");
const { registerAuthModule } = require("./auth");
const { registerSubscriptionModule } = require("./subscription");
const { registerStaffModule } = require("./staff");
const { registerPayrollModule } = require("./payroll");

function registerModules(app) {
  registerAuthModule(app);
  registerTemplateModule(app);
  registerSubscriptionModule(app);
  registerStaffModule(app);
  registerPayrollModule(app);
}

module.exports = { registerModules };
