const AuthController = require("./controller/AuthController");
const { verifyJwt } = require("../../middlewares/authMiddleware");

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
