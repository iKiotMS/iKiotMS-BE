const SubscriptionController = require("./controller/SubscriptionController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

/**
 * @openapi
 * /subscription/free-trial:
 *   post:
 *     tags:
 *       - Subscription
 *     summary: Assign free trial to existing tenant owner account
 *     description: Assign a 7-day free trial subscription to an already registered tenant owner
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: Free trial assigned successfully
 *       400:
 *         description: Bad request (already has subscription or plan not available)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 * /subscription/status:
 *   get:
 *     tags:
 *       - Subscription
 *     summary: Check trial subscription status
 *     description: Get current trial status for the authenticated user's tenant
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trial status retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to check trial status
 * /subscription/upgrade/{tenantId}:
 *   post:
 *     tags:
 *       - Subscription
 *     summary: Upgrade or change subscription plan (admin/internal, no payment)
 *     description: Directly change tenant subscription to PLUS or PRO plan without payment
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
 *               - planCode
 *             properties:
 *               planCode:
 *                 type: string
 *                 enum: [TRIAL, PLUS, PRO]
 *                 example: PLUS
 *     responses:
 *       200:
 *         description: Plan upgraded successfully
 *       400:
 *         description: Bad request (no subscription or invalid plan)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 * /subscription/upgrade/initiate:
 *   post:
 *     tags:
 *       - Subscription
 *     summary: Initiate paid plan upgrade via SePay
 *     description: Creates a pending invoice and returns QR code URL for bank transfer payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planCode
 *             properties:
 *               planCode:
 *                 type: string
 *                 enum: [PLUS, PRO]
 *                 example: PLUS
 *     responses:
 *       200:
 *         description: Invoice created, QR code URL returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     invoiceId:
 *                       type: string
 *                     paymentReference:
 *                       type: string
 *                       example: IKMSA1B2C3
 *                     amount:
 *                       type: number
 *                     qrDataUrl:
 *                       type: string
 *                     expiredAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 * /webhook/sepay:
 *   post:
 *     tags:
 *       - Webhook
 *     summary: SePay payment webhook
 *     description: Called by SePay when a bank transfer is detected. Activates subscription on successful payment.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               gateway:
 *                 type: string
 *               transactionDate:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *               content:
 *                 type: string
 *               transferType:
 *                 type: string
 *                 enum: [in, out]
 *               transferAmount:
 *                 type: number
 *               referenceCode:
 *                 type: string
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook processed
 */
const registerSubscriptionModule = (app) => {
  const subscriptionRoutes = [
    {
      method: "post",
      path: "/subscription/free-trial",
      handler: SubscriptionController.assignFreeTrial.bind(
        SubscriptionController,
      ),
      protected: true,
    },
    {
      method: "get",
      path: "/subscription/status",
      handler: SubscriptionController.checkTrialStatus.bind(
        SubscriptionController,
      ),
      protected: true,
    },
    {
      method: "post",
      path: "/subscription/upgrade/:tenantId",
      handler: SubscriptionController.upgradePlan.bind(SubscriptionController),
      protected: true,
    },
    {
      method: "post",
      path: "/subscription/upgrade/initiate",
      handler: SubscriptionController.initiateUpgrade.bind(
        SubscriptionController,
      ),
      protected: true,
    },
    {
      method: "post",
      path: "/webhook/sepay",
      handler: SubscriptionController.handleSepayWebhook.bind(
        SubscriptionController,
      ),
      protected: false,
    },
    {
      method: "post",
      path: "/webhook/sepay/order",
      handler: SubscriptionController.handleSepayOrderWebhook.bind(
        SubscriptionController,
      ),
      protected: false,
    },
    {
      method: "get",
      path: "/subscription/invoice/:invoiceId/status",
      handler: SubscriptionController.getInvoiceStatus.bind(
        SubscriptionController,
      ),
      protected: true,
    },
  ];

  subscriptionRoutes.forEach((route) => {
    const handlers = route.protected
      ? [verifyJwt, route.handler]
      : [route.handler];

    if (route.method === "post") {
      app.post(route.path, ...handlers);
    } else if (route.method === "get") {
      app.get(route.path, ...handlers);
    }
  });

  console.log("✓ Subscription module registered");
};

module.exports = { registerSubscriptionModule };
