const AuthController = require("./controller/AuthController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login user
 *     description: Authenticate user with phone number and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - password
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Invalid credentials
 * /auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register new tenant owner
 *     description: Create a new tenant owner user and tenant record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - password
 *               - tenantName
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *               password:
 *                 type: string
 *                 example: securepassword123
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               tenantName:
 *                 type: string
 *                 example: "My Company"
 *               tenantPhoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *               tenantMainAddress:
 *                 type: string
 *                 example: "123 Business St, City, State"
 *               tenantTaxNumber:
 *                 type: string
 *                 example: "TAX123456"
 *     responses:
 *       201:
 *         description: Tenant owner registered successfully
 *       400:
 *         description: Validation failed
 *       500:
 *         description: Registration failed
 * /auth/refresh:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Refresh access token
 *     description: Get new access token using refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 * /auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Logout user
 *     description: Logout and invalidate refresh token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
const registerAuthModule = (app) => {
  const authRoutes = [
    {
      method: "post",
      path: "/auth/login",
      handler: AuthController.login.bind(AuthController),
      protected: false,
    },
    {
      method: "post",
      path: "/auth/register",
      handler: AuthController.register.bind(AuthController),
      protected: false,
    },
    {
      method: "post",
      path: "/auth/refresh",
      handler: AuthController.refresh.bind(AuthController),
      protected: false,
    },
    {
      method: "post",
      path: "/auth/logout",
      handler: AuthController.logout.bind(AuthController),
      protected: true,
    },
  ];

  authRoutes.forEach((route) => {
    const handlers = route.protected
      ? [verifyJwt, route.handler]
      : [route.handler];

    if (route.method === "post") {
      app.post(route.path, ...handlers);
    } else if (route.method === "get") {
      app.get(route.path, ...handlers);
    }
  });

  console.log("✓ Auth module registered");
};

module.exports = { registerAuthModule };