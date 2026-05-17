const { registerTemplateModule } = require("./template");

function registerModules(app) {
  registerTemplateModule(app);
}

module.exports = { registerModules };
