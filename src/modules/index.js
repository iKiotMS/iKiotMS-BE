const { registerTemplateModule } = require("./template");
const { registerAuthModule } = require("./auth");

function registerModules(app) {
  registerAuthModule(app);
  registerTemplateModule(app);
}

module.exports = { registerModules };
