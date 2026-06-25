const CategoryController = require("./controller/CategoryController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

/**
 * @openapi
 * /categories:
 *   post:
 *     tags: [Categories]
 *     summary: Create a new category
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               parentId: { type: string }
 *               description: { type: string }
 *               imageUrl: { type: string }
 *     responses:
 *       201:
 *         description: Category created successfully
 *   get:
 *     tags: [Categories]
 *     summary: Get list of categories
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: parentId
 *         schema: { type: string }
 *         description: Filter by parent category. Use 'null' to fetch top-level categories.
 *     responses:
 *       200:
 *         description: List of categories
 * /categories/tree:
 *   get:
 *     tags: [Categories]
 *     summary: Get category tree
 *     description: Returns the entire category hierarchy in a nested tree structure
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category tree structure
 * /categories/{id}:
 *   get:
 *     tags: [Categories]
 *     summary: Get category by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category details
 *   patch:
 *     tags: [Categories]
 *     summary: Update category
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
 *               parentId: { type: string }
 *               description: { type: string }
 *               imageUrl: { type: string }
 *     responses:
 *       200:
 *         description: Category updated
 *   delete:
 *     tags: [Categories]
 *     summary: Delete category
 *     description: Fails if the category has sub-categories
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category deleted
 *       400:
 *         description: Cannot delete because it has sub-categories
 */
const registerCategoryModule = (app) => {
  app.post("/categories", verifyJwt, CategoryController.create.bind(CategoryController));
  app.get("/categories", verifyJwt, CategoryController.getList.bind(CategoryController));
  app.get("/categories/tree", verifyJwt, CategoryController.getTree.bind(CategoryController));
  app.get("/categories/:id", verifyJwt, CategoryController.getDetail.bind(CategoryController));
  app.patch("/categories/:id", verifyJwt, CategoryController.update.bind(CategoryController));
  app.delete("/categories/:id", verifyJwt, CategoryController.delete.bind(CategoryController));

  console.log("✓ Category module registered");
};

module.exports = { registerCategoryModule };
