const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "iKiotMS API",
      version: "1.0.0",
      description: "API documentation for iKiotMS backend",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3800}`,
        description: "Local development server",
      },
      {
        url: "https://ikiotms-be.onrender.com",
        description: "Hosted dev server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/modules/**/*.js"],
};

const specs = swaggerJsdoc(options);

const setupSwagger = (app) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
  console.log(
    `Swagger UI on: http://localhost:${process.env.PORT || 3800}/api-docs`,
  );
};

module.exports = { setupSwagger };
