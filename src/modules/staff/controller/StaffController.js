const { getTemplateSummary } = require('../service/template.service');

class StaffController{
  async create(req, res){
    try{
      const {tenantId} = req.user.tenantId;
      const data = req.body;

      const staff = await StaffService.createStaff({tenantId}, data);

      res.status(201).json(staff);
    }catch(error) {
      res.status(500).json({ error: error.message });
    }
  }

}

module.exports = { registerTemplateController };