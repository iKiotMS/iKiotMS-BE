const { Category } = require("../../../models");

class CategoryService {
  async create(data) {
    const category = new Category(data);
    await category.save();
    return category;
  }

  async getList(query) {
    const { page = 1, limit = 10, search, parentId } = query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }
    if (parentId !== undefined) {
      // Allow fetching top-level categories by passing parentId=null
      filter.parentId = parentId === "null" ? null : parentId;
    }

    const [data, total] = await Promise.all([
      Category.find(filter)
        .populate("parentId", "name")
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Category.countDocuments(filter),
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

  async getTree() {
    const categories = await Category.find().lean();

    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat._id.toString()] = { ...cat, children: [] };
    });

    const tree = [];
    categories.forEach(cat => {
      const node = categoryMap[cat._id.toString()];
      if (cat.parentId) {
        const parentIdStr = cat.parentId.toString();
        if (categoryMap[parentIdStr]) {
          categoryMap[parentIdStr].children.push(node);
        } else {
          // If parent is somehow missing in DB, treat as top-level
          tree.push(node);
        }
      } else {
        tree.push(node);
      }
    });

    return tree;
  }

  async getDetail(categoryId) {
    const category = await Category.findById(categoryId).populate("parentId", "name").lean();
    if (!category) {
      throw new Error("Category not found");
    }

    // Build breadcrumbs
    const breadcrumbs = [];
    let currentId = category.parentId ? category.parentId._id : null;
    
    // Prevent infinite loop in case of bad data, limit depth to 20
    let depthCount = 0;
    while (currentId && depthCount < 20) {
      const parent = await Category.findById(currentId).lean();
      if (parent) {
        breadcrumbs.unshift({ _id: parent._id, name: parent.name });
        currentId = parent.parentId;
      } else {
        currentId = null;
      }
      depthCount++;
    }
    
    category.breadcrumbs = breadcrumbs;
    return category;
  }

  async checkCircularReference(categoryId, newParentId) {
    if (!newParentId) return;
    
    if (categoryId.toString() === newParentId.toString()) {
      throw new Error("Category cannot be its own parent");
    }

    let currentParentId = newParentId;
    let depthCount = 0;
    
    while (currentParentId && depthCount < 20) {
      if (currentParentId.toString() === categoryId.toString()) {
        throw new Error("Circular reference detected: Cannot set a descendant as a parent");
      }
      const parentCategory = await Category.findById(currentParentId).lean();
      currentParentId = parentCategory ? parentCategory.parentId : null;
      depthCount++;
    }
  }

  async update(categoryId, updateData) {
    if (updateData.parentId !== undefined) {
      await this.checkCircularReference(categoryId, updateData.parentId);
    }

    const category = await Category.findByIdAndUpdate(
      categoryId,
      { $set: updateData },
      { new: true }
    );
    if (!category) {
      throw new Error("Category not found");
    }
    return category;
  }

  async delete(categoryId) {
    // Check if there are sub-categories
    const subCategoriesCount = await Category.countDocuments({ parentId: categoryId });
    if (subCategoriesCount > 0) {
      throw new Error("Cannot delete category because it has sub-categories");
    }

    const category = await Category.findByIdAndDelete(categoryId);
    if (!category) {
      throw new Error("Category not found");
    }
    return category;
  }
}

module.exports = new CategoryService();
