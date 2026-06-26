const { Brand } = require("../../../models");

class BrandService {
  async create(data) {
    const brand = new Brand(data);
    await brand.save();
    return brand;
  }

  async getList(query) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const [data, total] = await Promise.all([
      Brand.find(filter).skip(skip).limit(Number(limit)).lean(),
      Brand.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDetail(brandId) {
    const brand = await Brand.findById(brandId).lean();
    if (!brand) {
      throw new Error("Brand not found");
    }
    return brand;
  }

  async update(brandId, updateData) {
    const brand = await Brand.findByIdAndUpdate(
      brandId,
      { $set: updateData },
      { new: true }
    );
    if (!brand) {
      throw new Error("Brand not found");
    }
    return brand;
  }

  async delete(brandId) {
    const brand = await Brand.findByIdAndDelete(brandId);
    if (!brand) {
      throw new Error("Brand not found");
    }
    return brand;
  }
}

module.exports = new BrandService();
