const TenantController = require('./controller/TenantController');
const { verifyJwt } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/authorizationMiddleware');

/**
 * @openapi
 * /tenant/me:
 *   get:
 *     tags:
 *       - Tenant
 *     summary: Get own tenant info
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant info
 *       401:
 *         description: Unauthorized
 * /tenant/banking:
 *   put:
 *     tags:
 *       - Tenant
 *     summary: Update tenant bank account info
 *     description: TENANT_OWNER updates their own bank account details used for order QR payments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountNumber
 *               - bankName
 *               - accountName
 *             properties:
 *               accountNumber:
 *                 type: string
 *                 example: "0123456789"
 *               bankName:
 *                 type: string
 *                 example: MBBank
 *               accountName:
 *                 type: string
 *                 example: NGUYEN VAN A
 *     responses:
 *       200:
 *         description: Banking info updated
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 * /tenant/{tenantId}/sepay-key:
 *   put:
 *     tags:
 *       - Tenant
 *     summary: Set SePay webhook key for a tenant (SUPER_ADMIN only)
 *     description: After manually connecting tenant's bank account in SePay dashboard, save the resulting webhook API key
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sepayWebhookApiKey
 *             properties:
 *               sepayWebhookApiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: SePay key saved
 *       400:
 *         description: Missing key
 *       401:
 *         description: Unauthorized
 */
const registerTenantModule = (app) => {
  app.get('/tenant/me', verifyJwt, TenantController.getMyTenant.bind(TenantController));
  app.put(
    '/tenant/me',
    verifyJwt,
    authorize('tenants', 'update'),
    TenantController.updateMyTenant.bind(TenantController),
  );

  app.put(
    '/tenant/banking',
    verifyJwt,
    authorize('tenants', 'update'),
    TenantController.updateBanking.bind(TenantController),
  );

  app.put(
    '/tenant/:tenantId/sepay-key',
    verifyJwt,
    authorize('tenants', 'update'),
    TenantController.setSepayKey.bind(TenantController),
  );

  app.get(
    '/tenant',
    verifyJwt,
    TenantController.listTenants.bind(TenantController),
  );

  app.put(
    '/tenant/:tenantId',
    verifyJwt,
    TenantController.updateTenantAdmin.bind(TenantController),
  );

  console.log('✓ Tenant module registered');
};

module.exports = { registerTenantModule };
