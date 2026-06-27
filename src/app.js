const http = require("http");
const express = require("express");
const path = require("path");
const cors = require("cors");
const { registerModules } = require("./modules");
const { getConfig } = require("./config");
const connectDB = require("./config/connectDB");
const { setupSwagger } = require("./config/setupSwagger");
const { initSocket } = require("./services/socketService");

require("dotenv").config();

const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: ["http://localhost:3000", "https://ikiot.vercel.app"],
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Serve uploaded files
  app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

  setupSwagger(app);

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  registerModules(app);

  return app;
};

const startServer = async () => {
  const app = createApp();
  const config = getConfig();

  connectDB();

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(config.port, () => {
    console.log(`Server listening on port ${config.port} (${config.nodeEnv})`);
  });
};

module.exports = { createApp, startServer };

if (require.main === module) {
  startServer();
}
