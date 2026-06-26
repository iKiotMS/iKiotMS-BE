const CustomerService = require("../service/CustomerService");
const CreateCustomerDTO = require("../dto/CreateCustomerDTO");
const UpdateCustomerDTO = require("../dto/UpdateCustomerDTO");
const CustomerQueryDTO = require("../dto/CustomerQueryDTO");

class CustomerController {
  async create(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const dto = new CreateCustomerDTO(req.body);
      const { isValid, errors } = dto.validate();
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Validation failed", errors });
      }

      const customer = await CustomerService.createCustomer(tenantId, {
        name: dto.name,
        phone: dto.phone,
        gender: dto.gender,
        address: dto.address,
        dob: dto.dob,
      });

      res.status(201).json({ success: true, message: "Customer created", data: customer });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getList(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const dto = new CustomerQueryDTO(req.query);
      const { isValid, errors } = dto.validate();
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Validation failed", errors });
      }

      const result = await CustomerService.getCustomers(tenantId, dto);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getDetail(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const customer = await CustomerService.getCustomerById(tenantId, req.params.id);
      res.status(200).json({ success: true, data: customer });
    } catch (error) {
      const status = error.message === "Customer not found" ? 404 : 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const dto = new UpdateCustomerDTO(req.body);
      const { isValid, errors } = dto.validate();
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Validation failed", errors });
      }

      const updateFields = dto.toUpdateFields();
      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ success: false, message: "No fields to update" });
      }

      const customer = await CustomerService.updateCustomer(tenantId, req.params.id, updateFields);
      res.status(200).json({ success: true, message: "Customer updated", data: customer });
    } catch (error) {
      const status = error.message === "Customer not found" ? 404 : 400;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}

module.exports = new CustomerController();
