const CategoryService = require("../service/CategoryService");
const { deleteByPattern, deleteKeys, cacheKeys } = require("../../../utils/cacheHelpers");

class CategoryController {
  async create(req, res) {
    try {
      const category = await CategoryService.create(req.body);
      deleteByPattern("categories:list:*").catch(() => {});
      deleteKeys(cacheKeys.categoryTree()).catch(() => {});
      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: category,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getList(req, res) {
    try {
      const result = await CategoryService.getList(req.query);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getTree(req, res) {
    try {
      const tree = await CategoryService.getTree();
      res.status(200).json({
        success: true,
        data: tree,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getDetail(req, res) {
    try {
      const category = await CategoryService.getDetail(req.params.id);
      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  async update(req, res) {
    try {
      const category = await CategoryService.update(req.params.id, req.body);
      deleteByPattern("categories:list:*").catch(() => {});
      deleteKeys(
        cacheKeys.categoryTree(),
        cacheKeys.categoryDetail(req.params.id),
      ).catch(() => {});
      res.status(200).json({
        success: true,
        message: "Category updated successfully",
        data: category,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async delete(req, res) {
    try {
      await CategoryService.delete(req.params.id);
      deleteByPattern("categories:list:*").catch(() => {});
      deleteKeys(
        cacheKeys.categoryTree(),
        cacheKeys.categoryDetail(req.params.id),
      ).catch(() => {});
      res.status(200).json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new CategoryController();
