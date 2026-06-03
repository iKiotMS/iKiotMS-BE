const express = require("express");
const cors = require("cors");
const { registerModules } = require("./modules");
const { getConfig } = require("./config");
const connectDB = require("./config/connectDB");
const { setupSwagger } = require("./config/setupSwagger");

require("dotenv").config();

const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: [
        "http://localhost:3000",
      ],
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

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

  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port} (${config.nodeEnv})`);
  });
};

module.exports = { createApp, startServer };

if (require.main === module) {
  startServer();
}
