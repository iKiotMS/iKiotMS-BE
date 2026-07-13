const ProductController = require("./controller/ProductController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const {
  requireActiveSubscription,
} = require("../../middlewares/subscriptionMiddleware");

/**
 * @openapi
 * /products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product and its variants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, items]
 *             properties:
 *               name: { type: string }
 *               brandId: { type: string }
 *               categoryId: { type: string }
 *               categoryName: { type: string }
 *               supplierId: { type: string }
 *               status: { type: string, enum: [ACTIVE, INACTIVE], default: ACTIVE }
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url: { type: string }
 *                     isThumbnail: { type: boolean }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productCode, sku, retailPrice, costPrice]
 *                   properties:
 *                     productCode: { type: string }
 *                     sku: { type: string }
 *                     barcode: { type: string }
 *                     description: { type: string }
 *                     retailPrice: { type: number }
 *                     costPrice: { type: number }
 *                     VAT: { type: number }
 *                     warrantyPeriod: { type: string }
 *                     productDetails:
 *                       type: array
 *                       description: "List of variant attributes (e.g., Color, Size)"
 *                       items:
 *                         type: object
 *                         properties:
 *                           name: { type: string, example: "Màu sắc" }
 *                           value: { type: string, example: "Titan Tự Nhiên" }
 *                     initialStock:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           locationId: { type: string }
 *                           locationType: { type: string, enum: [branch, warehouse] }
 *                           stock: { type: number }
 *                     images:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           url: { type: string }
 *                           isThumbnail: { type: boolean }
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Validation error or duplicate SKU
 *   get:
 *     tags: [Products]
 *     summary: List products with search and filters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by product name
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *       - in: query
 *         name: supplierId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, DISCONTINUED] }
 *       - in: query
 *         name: locationId
 *         schema: { type: string }
 *         description: Filter products available at this branch/warehouse ID
 *       - in: query
 *         name: locationType
 *         schema: { type: string, enum: [branch, warehouse] }
 *         description: Filter by location type (e.g. all branches, or all warehouses)
 *     responses:
 *       200:
 *         description: List of products with their total local stock
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name: { type: string }
 *                       totalStock: { type: number, description: "Total stock of this product at the specified location" }
 *                 pagination:
 *                   type: object
 * /products/search:
 *   get:
 *     tags: [Products]
 *     summary: Cross-branch product search (name, code, SKU, or barcode)
 *     description: >
 *       Matches a single query against product name (substring) and item
 *       code/SKU/barcode (prefix), returning full multi-location stock
 *       breakdown per result so the caller can see availability across
 *       every branch/warehouse, not just the currently active one.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string, minLength: 2 }
 *         description: Search text (min 2 characters). Matches name (substring) or code/SKU/barcode (prefix).
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *       - in: query
 *         name: supplierId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, DISCONTINUED] }
 *       - in: query
 *         name: locationId
 *         schema: { type: string }
 *         description: Restrict results to products with stock at this branch/warehouse ID.
 *       - in: query
 *         name: locationType
 *         schema: { type: string, enum: [branch, warehouse] }
 *     responses:
 *       200:
 *         description: List of matching products with full per-branch stock breakdown
 *       400:
 *         description: Invalid query parameters (e.g. q shorter than 2 characters)
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product details by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: locationId
 *         schema: { type: string }
 *         description: Optional. Filter to get the specific local stock for this branch/warehouse ID. If omitted, gets the system-wide stock sum.
 *     responses:
 *       200:
 *         description: Product details and its items
 *       404:
 *         description: Product not found
 *   patch:
 *     tags: [Products]
 *     summary: Update a product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               brandId: { type: string }
 *               categoryId: { type: string }
 *               categoryName: { type: string }
 *               supplierId: { type: string }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, DISCONTINUED] }
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url: { type: string }
 *                     isThumbnail: { type: boolean }
 *     responses:
 *       200:
 *         description: Product updated
 *       400:
 *         description: Validation error
 * /products/{id}/delete:
 *   delete:
 *     tags: [Products]
 *     summary: Soft delete a product
 *     description: Sets the product status to DISCONTINUED
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product soft deleted
 *       404:
 *         description: Product not found
 * /products/{productId}/items:
 *   post:
 *     tags: [Products]
 *     summary: Add a new item (variant) to an existing product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productCode, sku, retailPrice, costPrice]
 *             properties:
 *               productCode: { type: string }
 *               sku: { type: string }
 *               barcode: { type: string }
 *               description: { type: string }
 *               retailPrice: { type: number }
 *               costPrice: { type: number }
 *               VAT: { type: number }
 *               warrantyPeriod: { type: string }
 *               productDetails:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     value: { type: string }
 *               initialStock:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     locationId: { type: string }
 *                     locationType: { type: string, enum: [branch, warehouse] }
 *                     stock: { type: number }
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url: { type: string }
 *                     isThumbnail: { type: boolean }
 *     responses:
 *       201:
 *         description: Product item created successfully
 *       400:
 *         description: Validation error or duplicate SKU
 * /products/items/{itemId}:
 *   patch:
 *     tags: [Products]
 *     summary: Update an existing product item (variant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productCode: { type: string }
 *               sku: { type: string }
 *               retailPrice: { type: number }
 *               costPrice: { type: number }
 *     responses:
 *       200:
 *         description: Product item updated
 * /products/items/{itemId}/delete:
 *   delete:
 *     tags: [Products]
 *     summary: Hard delete a product item
 *     description: Fails if the item has active inventory stock > 0
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product item deleted
 *       400:
 *         description: Cannot delete item because active inventory exists
 *       404:
 *         description: Product item not found
 */
const registerProductModule = (app) => {
  app.post(
    "/products",
    verifyJwt,
    requireActiveSubscription,
    ProductController.create.bind(ProductController),
  );
  app.get(
    "/products",
    verifyJwt,
    ProductController.getList.bind(ProductController),
  );
  // Must be registered before "/products/:id" — otherwise Express matches
  // this path as id="search".
  app.get(
    "/products/search",
    verifyJwt,
    ProductController.search.bind(ProductController),
  );
  app.get(
    "/products/:id",
    verifyJwt,
    ProductController.getDetail.bind(ProductController),
  );
  app.patch(
    "/products/:id",
    verifyJwt,
    ProductController.update.bind(ProductController),
  );
  app.delete(
    "/products/:id/delete",
    verifyJwt,
    ProductController.softDelete.bind(ProductController),
  );

  // Product Item (Variant) Routes
  app.post(
    "/products/:productId/items",
    verifyJwt,
    requireActiveSubscription,
    ProductController.createItem.bind(ProductController),
  );
  app.patch(
    "/products/items/:itemId",
    verifyJwt,
    ProductController.updateItem.bind(ProductController),
  );
  app.delete(
    "/products/items/:itemId/delete",
    verifyJwt,
    ProductController.deleteItem.bind(ProductController),
  );

  console.log("✓ Product module registered");
};

module.exports = { registerProductModule };
