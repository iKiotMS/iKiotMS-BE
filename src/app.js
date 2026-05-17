const express = require("express");
const { registerModules } = require("./modules");
const { getConfig } = require("./config");
const connectDB = require("./config/connectDB");
require("dotenv").config();
const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

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
