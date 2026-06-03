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
 * /subscription/trial-status:
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
 */
const registerSubscriptionModule = (app) => {
  const subscriptionRoutes = [
    {
      method: "post",
      path: "/subscription/free-trial",
      handler: SubscriptionController.assignFreeTrial.bind(SubscriptionController),
      protected: true,
    },
    {
      method: "get",
      path: "/subscription/trial-status",
      handler: SubscriptionController.checkTrialStatus.bind(SubscriptionController),
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