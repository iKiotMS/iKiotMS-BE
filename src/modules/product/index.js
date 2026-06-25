const ProductController = require("./controller/ProductController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

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
 *         description: List of products with variants and stock
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
 *                       totalStock: { type: number, description: "Total stock across all items and locations" }
 *                       items:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             sku: { type: string }
 *                             stock: { type: number, description: "Total stock of this specific variant across allowed locations" }
 *                             stockDetails:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   locationId: { type: string }
 *                                   locationType: { type: string }
 *                                   stock: { type: number }
 *                 pagination:
 *                   type: object
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
  app.post("/products", verifyJwt, ProductController.create.bind(ProductController));
  app.get("/products", verifyJwt, ProductController.getList.bind(ProductController));
  app.get("/products/:id", verifyJwt, ProductController.getDetail.bind(ProductController));
  app.patch("/products/:id", verifyJwt, ProductController.update.bind(ProductController));
  app.delete("/products/:id/delete", verifyJwt, ProductController.softDelete.bind(ProductController));

  // Product Item (Variant) Routes
  app.post("/products/:productId/items", verifyJwt, ProductController.createItem.bind(ProductController));
  app.patch("/products/items/:itemId", verifyJwt, ProductController.updateItem.bind(ProductController));
  app.delete("/products/items/:itemId/delete", verifyJwt, ProductController.deleteItem.bind(ProductController));

  console.log("✓ Product module registered");
};

module.exports = { registerProductModule };
