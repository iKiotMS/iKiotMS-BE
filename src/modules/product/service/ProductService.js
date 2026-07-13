const mongoose = require("mongoose");
const { Product, ProductItem, Inventory } = require("../../../models");
const InventoryService = require("../../inventory/service/InventoryService");

class ProductService {
  async createProduct(tenantId, productData, subscription) {
    const session = await mongoose.startSession();
    session.startTransaction();
    // Check product quota
    if (subscription) {
      const maxProducts = subscription.currentQuotaSnapshot.maxProducts;
      if (maxProducts > 0) {
        // -1 means unlimited
        const activeProductCount = await Product.countDocuments({
          tenantId,
          status: { $ne: "DISCONTINUED" },
        });
        if (activeProductCount >= maxProducts) {
          throw new Error(
            `Product limit reached. Your plan allows ${maxProducts} products. Current: ${activeProductCount}`,
          );
        }
      }

      try {
        // 0. Validate SKU Uniqueness within the payload itself
        const skus = productData.items.map((item) => item.sku);
        const uniqueSkus = new Set(skus);
        if (uniqueSkus.size !== skus.length) {
          throw new Error("Duplicate SKUs found in the request payload");
        }

        // 1. Validate SKU Uniqueness against Database
        const existingItems = await ProductItem.find({
          tenantId,
          sku: { $in: skus },
        }).session(session);

        if (existingItems.length > 0) {
          const duplicateSkus = existingItems.map((i) => i.sku).join(", ");
          throw new Error(
            `SKUs already exist in this tenant: ${duplicateSkus}`,
          );
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

        const insertedItems = await ProductItem.insertMany(productItemsData, {
          session,
        });

        // 4. Initialize Stock
        for (let i = 0; i < insertedItems.length; i++) {
          const itemDto = productData.items[i];
          if (itemDto.initialStock && itemDto.initialStock.length > 0) {
            await InventoryService.initializeStock(
              tenantId,
              insertedItems[i]._id,
              itemDto.initialStock,
              session,
            );
          }
        }

        await session.commitTransaction();
        session.endSession();

        return product;
      } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
      }

      return product;
    }
  }

  async getProducts(tenantId, query) {
    const {
      page,
      limit,
      search,
      categoryId,
      status,
      locationId,
      locationType,
    } = query;
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
    if (locationType || locationId) {
      const invFilter = { tenantId };
      if (locationType) invFilter.locationType = locationType;
      if (locationId) invFilter.locationId = locationId;

      const filterInventories = await Inventory.find(invFilter).lean();

      const productItemIds = filterInventories.map((i) => i.productItemId);

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

    if (data.length > 0) {
      const productIds = data.map((p) => p._id);
      const items = await ProductItem.find({
        tenantId,
        productId: { $in: productIds },
      }).lean();

      if (items.length > 0) {
        const itemIds = items.map((i) => i._id);

        const invQuery = { tenantId, productItemId: { $in: itemIds } };
        if (locationType) invQuery.locationType = locationType;
        if (locationId) invQuery.locationId = locationId;

        const inventories = await Inventory.find(invQuery).lean();

        // Group inventories by productItemId
        const inventoryMap = {};
        inventories.forEach((inv) => {
          const id = inv.productItemId.toString();
          if (!inventoryMap[id]) inventoryMap[id] = [];
          inventoryMap[id].push({
            locationId: inv.locationId,
            locationType: inv.locationType,
            stock: inv.stock,
          });
        });

        // Group items by productId
        const itemMap = {};
        items.forEach(item => {
          const pId = item.productId.toString();
          if (!itemMap[pId]) itemMap[pId] = [];
          
          item.stockDetails = inventoryMap[item._id.toString()] || [];
          item.stock = item.stockDetails.reduce((sum, inv) => sum + inv.stock, 0);
          itemMap[pId].push(item);
        });

        // Attach items to products
        data.forEach(product => {
          product.items = itemMap[product._id.toString()] || [];
          product.totalStock = product.items.reduce((sum, item) => sum + item.stock, 0);
        });
      } else {
        data.forEach((product) => {
          product.items = [];
          product.totalStock = 0;
        });
      }
    }

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

  async getProductById(tenantId, productId, query = {}) {
    const { locationId } = query;
    const product = await Product.findOne({ _id: productId, tenantId }).lean();
    if (!product) {
      throw new Error("Product not found");
    }

    const items = await ProductItem.find({ productId, tenantId }).lean();

    if (items.length > 0) {
      const itemIds = items.map((i) => i._id);
      
      // Fetch ALL inventories across the system for cross-branch visibility
      const inventories = await Inventory.find({ tenantId, productItemId: { $in: itemIds } }).lean();
      
      const inventoryMap = {};
      inventories.forEach(inv => {
        const id = inv.productItemId.toString();
        if (!inventoryMap[id]) inventoryMap[id] = [];
        inventoryMap[id].push({
          locationId: inv.locationId,
          locationType: inv.locationType,
          stock: inv.stock
        });
      });
      
      let totalStock = 0;
      items.forEach(item => {
        item.stockDetails = inventoryMap[item._id.toString()] || [];
        
        if (locationId) {
          // If a specific location is requested, set local stock
          const localInv = item.stockDetails.find(inv => inv.locationId.toString() === locationId.toString());
          item.stock = localInv ? localInv.stock : 0;
        } else {
          // Otherwise, sum all branches
          item.stock = item.stockDetails.reduce((sum, inv) => sum + inv.stock, 0);
        }
        
        totalStock += item.stock;
      });
      
      product.totalStock = totalStock;
    } else {
      product.totalStock = 0;
    }

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

    const existingSku = await ProductItem.findOne({
      tenantId,
      sku: itemData.sku,
    }).lean();
    if (existingSku) {
      throw new Error(`SKU already exists: ${itemData.sku}`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const productItem = new ProductItem({
        ...itemData,
        tenantId,
        productId,
        productName: product.name,
      });

      await productItem.save({ session });

      if (itemData.initialStock && itemData.initialStock.length > 0) {
        await InventoryService.initializeStock(
          tenantId,
          productItem._id,
          itemData.initialStock,
          session,
        );
      }

      await session.commitTransaction();
      session.endSession();

      return productItem;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async updateProductItem(tenantId, itemId, updateData) {
    // If SKU is being updated, check for duplicates
    if (updateData.sku) {
      const existingSku = await ProductItem.findOne({
        tenantId,
        sku: updateData.sku,
        _id: { $ne: itemId },
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
      stock: { $gt: 0 },
    });

    if (activeInventoryCount > 0) {
      throw new Error(
        "Cannot delete product item: Active inventory exists with stock > 0",
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const productItem = await ProductItem.findOneAndDelete({
        _id: itemId,
        tenantId,
      }).session(session);

      if (!productItem) {
        throw new Error("Product item not found");
      }

      // Also clean up zero-stock inventory records associated with this item
      await Inventory.deleteMany({ tenantId, productItemId: itemId }).session(
        session,
      );

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
