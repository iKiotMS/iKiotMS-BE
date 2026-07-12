const InventoryController = require("./controller/InventoryController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { authorize } = require("../../middlewares/authorizationMiddleware");

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
 *         description: Filter items at or below their own minStock threshold
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *         description: Search by product name or SKU
 *     responses:
 *       200:
 *         description: List of inventory records
 * /inventory/{id}/min-stock:
 *   patch:
 *     tags:
 *       - Inventory
 *     summary: Set the low-stock alert threshold for an inventory record
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [minStock]
 *             properties:
 *               minStock:
 *                 type: integer
 *                 minimum: 0
 *                 description: 0 disables the low-stock alert for this item
 *     responses:
 *       200:
 *         description: Threshold updated
 *       404:
 *         description: Inventory record not found
 */
const registerInventoryModule = (app) => {
  const inventoryRoutes = [
    { method: "get", path: "/inventory", handler: InventoryController.getList.bind(InventoryController), protected: true },
    {
      method: "patch",
      path: "/inventory/:id/min-stock",
      handler: InventoryController.updateMinStock.bind(InventoryController),
      protected: true,
      authorize: ["update", "manage"],
    },
  ];

  inventoryRoutes.forEach((route) => {
    const handlers = [];
    if (route.protected) handlers.push(verifyJwt);
    if (route.authorize) handlers.push(authorize("inventory", route.authorize));
    handlers.push(route.handler);
    app[route.method](route.path, ...handlers);
  });

  console.log("✓ Inventory module registered");
};

module.exports = { registerInventoryModule };
