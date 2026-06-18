const ProductService = require("../service/ProductService");
const CreateProductRequestDTO = require("../dto/CreateProductRequestDTO");
const UpdateProductRequestDTO = require("../dto/UpdateProductRequestDTO");
const ProductQueryDTO = require("../dto/ProductQueryDTO");

class ProductController {
  async create(req, res) {
    try {
      const tenantId = req.user.tenantId; // Assume tenantId is populated by verifyJwt
      if (!tenantId) {
        return res.status(403).json({ success: false, message: "Tenant context missing" });
      }

      const dto = new CreateProductRequestDTO(req.body);
      const validation = dto.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const product = await ProductService.createProduct(tenantId, dto);

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product,
      });
    } catch (error) {
      console.error("Create product error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to create product",
      });
    }
  }

  async getList(req, res) {
    try {
      const tenantId = req.user.tenantId;
      if (!tenantId) {
        return res.status(403).json({ success: false, message: "Tenant context missing" });
      }

      const queryDTO = new ProductQueryDTO(req.query);
      const validation = queryDTO.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid query parameters",
          errors: validation.errors,
        });
      }

      const result = await ProductService.getProducts(tenantId, queryDTO);

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve products",
      });
    }
  }

  async getDetail(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const product = await ProductService.getProductById(tenantId, id);

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      console.error("Get product detail error:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Product not found",
      });
    }
  }

  async update(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const dto = new UpdateProductRequestDTO(req.body);
      const validation = dto.validate();

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        });
      }

      const product = await ProductService.updateProduct(tenantId, id, dto);

      res.status(200).json({
        success: true,
        message: "Product updated successfully",
        data: product,
      });
    } catch (error) {
      console.error("Update product error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update product",
      });
    }
  }

  async softDelete(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;

      const product = await ProductService.softDeleteProduct(tenantId, id);

      res.status(200).json({
        success: true,
        message: "Product deleted successfully",
        data: product,
      });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to delete product",
      });
    }
  }
}

module.exports = new ProductController();
