const BranchController = require("./controller/BranchController");
const { verifyJwt } = require("../../middlewares/authMiddleware");
const { requireActiveSubscription } = require("../../middlewares/subscriptionMiddleware");
const { cacheResponse } = require("../../middlewares/cacheMiddleware");
const { cacheKeys } = require("../../utils/cacheHelpers");

/**
 * @openapi
 * /branches:
 *   post:
 *     tags:
 *       - Branch
 *     summary: Create a new branch
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
 *               - phoneNumber
 *             properties:
 *               name: { type: string }
 *               phoneNumber:
 *                 type: array
 *                 items: { type: string }
 *               address: { type: string }
 *               email: { type: string }
 *               attendanceTakingLocation:
 *                 type: object
 *                 properties:
 *                   latitude: { type: number }
 *                   longitude: { type: number }
 *                   allowedRadiusMeters: { type: number }
 *                   maxAccuracyMeters: { type: number }
 *     responses:
 *       201:
 *         description: Branch created successfully
 *   get:
 *     tags:
 *       - Branch
 *     summary: Get list of branches
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
 *         description: List of branches
 *
 * /branches/{id}:
 *   get:
 *     tags:
 *       - Branch
 *     summary: Get branch by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Branch details
 *       404:
 *         description: Branch not found
 *   patch:
 *     tags:
 *       - Branch
 *     summary: Update branch details
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
 *               phoneNumber:
 *                 type: array
 *                 items: { type: string }
 *               address: { type: string }
 *               email: { type: string }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, DELETED] }
 *               attendanceTakingLocation:
 *                 type: object
 *                 properties:
 *                   latitude: { type: number }
 *                   longitude: { type: number }
 *                   allowedRadiusMeters: { type: number }
 *                   maxAccuracyMeters: { type: number }
 *     responses:
 *       200:
 *         description: Branch updated
 *
 * /branches/{id}/delete:
 *   delete:
 *     tags:
 *       - Branch
 *     summary: Soft delete a branch
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Branch deleted
 */
const registerBranchModule = (app) => {
  app.post(
    "/branches",
    verifyJwt,
    requireActiveSubscription,
    BranchController.create.bind(BranchController),
  );

  app.get(
    "/branches",
    verifyJwt,
    cacheResponse(
      (req) => cacheKeys.branchList(req.user.tenantId, req.query),
      300,
    ),
    BranchController.getList.bind(BranchController),
  );

  app.get(
    "/branches/:id",
    verifyJwt,
    cacheResponse(
      (req) => cacheKeys.branchDetail(req.user.tenantId, req.params.id),
      300,
    ),
    BranchController.getById.bind(BranchController),
  );

  app.patch(
    "/branches/:id",
    verifyJwt,
    BranchController.update.bind(BranchController),
  );

  app.delete(
    "/branches/:id/delete",
    verifyJwt,
    BranchController.softDelete.bind(BranchController),
  );

  console.log("✓ Branch module registered");
};

module.exports = { registerBranchModule };
