import cors from "cors";
import express from "express";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";

import openApiSpec from "./docs/openapi";
import { errorHandler, notFound } from "./middleware/error";
import authRoutes from "./routes/auth.routes";
import featureRoutes from "./routes/feature.routes";
import orgRegistrationRoutes from "./routes/orgRegistration.routes";
import organizationRoutes from "./routes/organization.routes";
import roleRoutes from "./routes/role.routes";
import userRoutes from "./routes/user.routes";

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

app.get(/^\/api-docs$/, (req, res) => {
  res.redirect(301, "/api-docs/");
});

app.get(
  [
    "/swagger-ui.css",
    "/swagger-ui-bundle.js",
    "/swagger-ui-standalone-preset.js",
    "/swagger-ui-init.js",
    "/favicon-16x16.png",
    "/favicon-32x32.png",
  ],
  (req, res) => {
    res.redirect(302, `/api-docs${req.path}`);
  }
);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use("/api/auth", authRoutes);
app.use("/api/features", featureRoutes);
app.use("/api/org-registrations", orgRegistrationRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
