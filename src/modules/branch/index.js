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
 * /branches/{id}/manager:
 *   patch:
 *     tags:
 *       - Branch
 *     summary: Change branch manager
 *     description: Tenant owner assigns an active staff member in this branch as branch manager. The current branch manager is demoted to staff.
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
 *             required:
 *               - staffId
 *             properties:
 *               staffId:
 *                 type: string
 *                 example: 665abc1234567890abcdef12
 *     responses:
 *       200:
 *         description: Branch manager updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only tenant owner can change branch manager
 *       404:
 *         description: Branch not found
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

  app.patch(
    "/branches/:id/manager",
    verifyJwt,
    BranchController.assignManager.bind(BranchController),
  );

  app.delete(
    "/branches/:id/delete",
    verifyJwt,
    BranchController.softDelete.bind(BranchController),
  );

  console.log("✓ Branch module registered");
};

module.exports = { registerBranchModule };
