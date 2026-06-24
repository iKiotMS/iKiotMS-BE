const WarehouseController = require("./controller/WarehouseController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

/**
 * @openapi
 * /warehouses:
 *   post:
 *     tags:
 *       - Warehouse
 *     summary: Create a new warehouse
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *               attendanceTakingLocation:
 *                 type: object
 *                 properties:
 *                   latitude: { type: number }
 *                   longitude: { type: number }
 *                   allowedRadiusMeters: { type: number }
 *     responses:
 *       201:
 *         description: Warehouse created successfully
 *   get:
 *     tags:
 *       - Warehouse
 *     summary: Get list of warehouses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10 }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, DELETED] }
 *     responses:
 *       200:
 *         description: List of warehouses
 *
 * /warehouses/{id}:
 *   get:
 *     tags:
 *       - Warehouse
 *     summary: Get warehouse by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Warehouse details
 *       404:
 *         description: Warehouse not found
 *   patch:
 *     tags:
 *       - Warehouse
 *     summary: Update warehouse details
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
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, DELETED] }
 *               attendanceTakingLocation:
 *                 type: object
 *                 properties:
 *                   latitude: { type: number }
 *                   longitude: { type: number }
 *                   allowedRadiusMeters: { type: number }
 *     responses:
 *       200:
 *         description: Warehouse updated
 *
 * /warehouses/{id}/delete:
 *   delete:
 *     tags:
 *       - Warehouse
 *     summary: Soft delete a warehouse
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Warehouse deleted
 */
const registerWarehouseModule = (app) => {
  const warehouseRoutes = [
    { method: "post", path: "/warehouses", handler: WarehouseController.create.bind(WarehouseController), protected: true },
    { method: "get", path: "/warehouses", handler: WarehouseController.getList.bind(WarehouseController), protected: true },
    { method: "get", path: "/warehouses/:id", handler: WarehouseController.getById.bind(WarehouseController), protected: true },
    { method: "patch", path: "/warehouses/:id", handler: WarehouseController.update.bind(WarehouseController), protected: true },
    { method: "delete", path: "/warehouses/:id/delete", handler: WarehouseController.softDelete.bind(WarehouseController), protected: true },
  ];

  warehouseRoutes.forEach((route) => {
    const handlers = route.protected ? [verifyJwt, route.handler] : [route.handler];
    app[route.method](route.path, ...handlers);
  });

  console.log("✓ Warehouse module registered");
};

module.exports = { registerWarehouseModule };
