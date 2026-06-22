const mongoose = require("mongoose");
const { Product, ProductItem, Inventory } = require("../../../models");

class ProductService {
  async createProduct(tenantId, productData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Validate SKU Uniqueness for all items
      const skus = productData.items.map((item) => item.sku);
      const existingItems = await ProductItem.find({
        tenantId,
        sku: { $in: skus },
      }).session(session);

      if (existingItems.length > 0) {
        const duplicateSkus = existingItems.map((i) => i.sku).join(", ");
        throw new Error(`SKUs already exist in this tenant: ${duplicateSkus}`);
      }

      // 2. Create the base Product
      const product = new Product({
        tenantId,
        name: productData.name,
        brandId: productData.brandId,
        categoryId: productData.categoryId,
        categoryName: productData.categoryName,
        supplierId: productData.supplierId,
        status: productData.status,
        images: productData.images,
      });

      await product.save({ session });

      // 3. Create ProductItems (variants)
      const productItemsData = productData.items.map((item) => ({
        ...item,
        tenantId,
        productId: product._id,
        productName: productData.name,
      }));

      await ProductItem.insertMany(productItemsData, { session });

      await session.commitTransaction();
      session.endSession();

      return product;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async getProducts(tenantId, query) {
    const { page, limit, search, categoryId, status, locationId, locationType } = query;
    const skip = (page - 1) * limit;

    // Build the query object
    const filter = { tenantId };

    if (status) {
      filter.status = status;
    } else {
      // By default, do not return discontinued products
      filter.status = { $ne: "DISCONTINUED" };
    }

    if (categoryId) {
      filter.categoryId = categoryId;
    }

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    // Location Filter Logic
    if (locationId && locationType) {
      const inventories = await Inventory.find({
        tenantId,
        locationId,
        locationType,
      }).lean();

      const productItemIds = inventories.map((i) => i.productItemId);

      const productItems = await ProductItem.find({
        tenantId,
        _id: { $in: productItemIds },
      }).lean();

      const productIds = productItems.map((pi) => pi.productId);

      filter._id = { $in: productIds };
    }

    const [data, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProductById(tenantId, productId) {
    const product = await Product.findOne({ _id: productId, tenantId }).lean();
    if (!product) {
      throw new Error("Product not found");
    }

    const items = await ProductItem.find({ productId, tenantId }).lean();

    return {
      ...product,
      items,
    };
  }

  async updateProduct(tenantId, productId, updateData) {
    const product = await Product.findOneAndUpdate(
      { _id: productId, tenantId },
      { $set: updateData },
      { new: true },
    );

    if (!product) {
      throw new Error("Product not found");
    }

    // If product name changes, update productName in all related ProductItems
    if (updateData.name) {
      await ProductItem.updateMany(
        { productId, tenantId },
        { $set: { productName: updateData.name } },
      );
    }

    return product;
  }

  async softDeleteProduct(tenantId, productId) {
    // Soft delete product by setting status to DISCONTINUED
    const product = await Product.findOneAndUpdate(
      { _id: productId, tenantId },
      { $set: { status: "DISCONTINUED" } },
      { new: true },
    );

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  }

  // --- PRODUCT ITEM (VARIANT) METHODS ---

  async createProductItem(tenantId, productId, itemData) {
    const product = await Product.findOne({ _id: productId, tenantId }).lean();
    if (!product) {
      throw new Error("Product not found");
    }

    const existingSku = await ProductItem.findOne({ tenantId, sku: itemData.sku }).lean();
    if (existingSku) {
      throw new Error(`SKU already exists: ${itemData.sku}`);
    }

    const productItem = new ProductItem({
      ...itemData,
      tenantId,
      productId,
      productName: product.name,
    });

    await productItem.save();
    return productItem;
  }

  async updateProductItem(tenantId, itemId, updateData) {
    // If SKU is being updated, check for duplicates
    if (updateData.sku) {
      const existingSku = await ProductItem.findOne({ 
        tenantId, 
        sku: updateData.sku, 
        _id: { $ne: itemId } 
      }).lean();
      if (existingSku) {
        throw new Error(`SKU already exists: ${updateData.sku}`);
      }
    }

    const productItem = await ProductItem.findOneAndUpdate(
      { _id: itemId, tenantId },
      { $set: updateData },
      { new: true },
    );

    if (!productItem) {
      throw new Error("Product item not found");
    }

    return productItem;
  }

  async deleteProductItem(tenantId, itemId) {
    // Check if there is any inventory with stock > 0 for this item
    const activeInventoryCount = await Inventory.countDocuments({ 
      tenantId, 
      productItemId: itemId, 
      stock: { $gt: 0 } 
    });

    if (activeInventoryCount > 0) {
      throw new Error("Cannot delete product item: Active inventory exists with stock > 0");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const productItem = await ProductItem.findOneAndDelete({ _id: itemId, tenantId }).session(session);
      
      if (!productItem) {
        throw new Error("Product item not found");
      }

      // Also clean up zero-stock inventory records associated with this item
      await Inventory.deleteMany({ tenantId, productItemId: itemId }).session(session);

      await session.commitTransaction();
      session.endSession();

      return productItem;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

module.exports = new ProductService();
