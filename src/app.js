const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const authRoutes = require("./routes/auth.routes");
const featureRoutes = require("./routes/feature.routes");
const orgRegistrationRoutes = require("./routes/orgRegistration.routes");
const organizationRoutes = require("./routes/organization.routes");
const roleRoutes = require("./routes/role.routes");
const userRoutes = require("./routes/user.routes");
const openApiSpec = require("./docs/openapi");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "placement-decode-api" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "placement-decode-api" });
});

app.get("/openapi.json", (req, res) => {
  res.json(openApiSpec);
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use("/api/auth", authRoutes);
app.use("/api/features", featureRoutes);
app.use("/api/org-registrations", orgRegistrationRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
