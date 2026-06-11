const { getTemplateSummary } = require('../service/template.service');

function registerTemplateController(app) {
  app.get('/template', (_request, response) => {
    response.json(getTemplateSummary());
  });
}

module.exports = { registerTemplateController };