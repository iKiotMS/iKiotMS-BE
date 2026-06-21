const InventoryController = require("./controller/InventoryController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

/**
 * @openapi
 * /inventory:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get list of inventory records
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10 }
 *       - name: locationId
 *         in: query
 *         schema: { type: string }
 *         description: ID of the branch or warehouse
 *       - name: locationType
 *         in: query
 *         schema: { type: string, enum: [branch, warehouse] }
 *         description: Required if locationId is provided
 *       - name: isLowStock
 *         in: query
 *         schema: { type: boolean }
 *         description: Filter items with stock <= 10
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *         description: Search by product name or SKU
 *     responses:
 *       200:
 *         description: List of inventory records
 */
const registerInventoryModule = (app) => {
  const inventoryRoutes = [
    { method: "get", path: "/inventory", handler: InventoryController.getList.bind(InventoryController), protected: true },
  ];

  inventoryRoutes.forEach((route) => {
    const handlers = route.protected ? [verifyJwt, route.handler] : [route.handler];
    app[route.method](route.path, ...handlers);
  });

  console.log("✓ Inventory module registered");
};

module.exports = { registerInventoryModule };
