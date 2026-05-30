const AuthController = require("./controller/AuthController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login user
 *     description: Authenticate user with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
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
