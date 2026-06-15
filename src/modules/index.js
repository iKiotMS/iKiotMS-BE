const { registerTemplateModule } = require("./template");
const { registerAuthModule } = require("./auth");
const { registerSubscriptionModule } = require("./subscription");
const { registerUploadModule } = require("./upload");
const { registerProductModule } = require("./product");

function registerModules(app) {
  registerAuthModule(app);
  registerTemplateModule(app);
  registerSubscriptionModule(app);
  registerUploadModule(app);
  registerProductModule(app);
}

module.exports = { registerModules };
