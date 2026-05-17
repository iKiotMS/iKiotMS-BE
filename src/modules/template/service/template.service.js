const { createTemplateDto } = require('../dto/create-template.dto');

function getTemplateSummary() {
  return {
    module: 'template',
    status: 'ready',
    dto: createTemplateDto,
  };
}

module.exports = { getTemplateSummary };