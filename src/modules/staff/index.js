const { registerTemplateController } = require('./controller/template.controller');

function registerTemplateModule(app) {
  registerTemplateController(app);
}

module.exports = { registerTemplateModule };