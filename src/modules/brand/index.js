const BrandController = require("./controller/BrandController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

/**
 * @openapi
 * /brands:
 *   post:
 *     tags: [Brands]
 *     summary: Create a new brand
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
 *               description: { type: string }
 *               logo: { type: string }
 *     responses:
 *       201:
 *         description: Brand created successfully
 *   get:
 *     tags: [Brands]
 *     summary: Get list of brands
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
 *     responses:
 *       200:
 *         description: List of brands
 * /brands/{id}:
 *   get:
 *     tags: [Brands]
 *     summary: Get brand by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Brand details
 *   patch:
 *     tags: [Brands]
 *     summary: Update brand
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
 *               description: { type: string }
 *               logo: { type: string }
 *     responses:
 *       200:
 *         description: Brand updated
 *   delete:
 *     tags: [Brands]
 *     summary: Delete brand
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Brand deleted
 */
const registerBrandModule = (app) => {
  app.post("/brands", verifyJwt, BrandController.create.bind(BrandController));
  app.get("/brands", verifyJwt, BrandController.getList.bind(BrandController));
  app.get("/brands/:id", verifyJwt, BrandController.getDetail.bind(BrandController));
  app.patch("/brands/:id", verifyJwt, BrandController.update.bind(BrandController));
  app.delete("/brands/:id", verifyJwt, BrandController.delete.bind(BrandController));

  console.log("✓ Brand module registered");
};

module.exports = { registerBrandModule };
