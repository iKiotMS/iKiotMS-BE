class BaseService {
  constructor(model) {
    this.model = model;
  }

  normalizeStaffRole(role) {
    if (!role || typeof role !== "string") {
      return null;
    }

    return role.trim().toUpperCase();
  }

  getPagination({ page = 1, recordPerPage = 10 } = {}) {
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.max(parseInt(recordPerPage, 10) || 10, 1);

    return {
      page: pageNumber,
      recordPerPage: perPage,
      skip: (pageNumber - 1) * perPage,
    };
  }

  async create(data) {
    return await this.model.create(data);
  }

  async findAll(filter = {}, options = {}) {
    let query = this.model.find(filter);

    if (options.select) query = query.select(options.select);
    if (options.populate) {
      options.populate.forEach((field) => {
        query = query.populate(field);
      });
    }

    return await query.lean();
  }

  async findOne(filter = {}, options = {}) {
    let query = this.model.findOne(filter);

    if (options.select) query = query.select(options.select);
    if (options.populate) {
      options.populate.forEach((field) => {
        query = query.populate(field);
      });
    }

    return await query.lean();
  }

  async updateOne(filter, data) {
    return await this.model.findOneAndUpdate(filter, data, {
      new: true,
      runValidators: true,
    });
  }

  async deleteOne(filter) {
    return await this.model.findOneAndDelete(filter);
  }
}

module.exports = BaseService;
