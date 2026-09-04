import cors from "cors";
import express from "express";
import morgan from "morgan";

import openApiSpec from "./docs/openapi";
import { errorHandler, notFound } from "./middleware/error";
import authRoutes from "./routes/auth.routes";
import assessmentRoutes from "./routes/assessment.routes";
import featureRoutes from "./routes/feature.routes";
import orgRegistrationRoutes from "./routes/orgRegistration.routes";
import organizationRoutes from "./routes/organization.routes";
import roleRoutes from "./routes/role.routes";
import sectionRoutes from "./routes/section.routes";
import userRoutes from "./routes/user.routes";

const app = express();
const swaggerUiVersion = "5.32.11";

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options(/.*/, cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "placement-decode-api",
    docs: "/api-docs",
    health: "/health",
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "placement-decode-api" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "placement-decode-api" });
});

app.get("/openapi.json", (req, res) => {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || req.protocol;
  const host = req.get("host");

  res.json({
    ...openApiSpec,
    servers: host
      ? [
          {
            url: `${protocol}://${host}`,
            description: "Current deployment",
          },
        ]
      : openApiSpec.servers,
  });
});

app.get(["/api-docs/swagger-ui-init.js", "/swagger-ui-init.js"], (req, res) => {
  res.type("application/javascript").send(`
window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: "/openapi.json",
    dom_id: "#swagger-ui",
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: "StandaloneLayout"
  });
};
`);
});

app.get(/^\/api-docs\/?$/, (req, res) => {
  res.type("html").send(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Placement Decode API Docs</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${swaggerUiVersion}/swagger-ui.css" />
    <link rel="icon" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${swaggerUiVersion}/favicon-32x32.png" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${swaggerUiVersion}/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${swaggerUiVersion}/swagger-ui-standalone-preset.js"></script>
    <script src="/api-docs/swagger-ui-init.js"></script>
  </body>
</html>
`);
});

app.use("/api/auth", authRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/features", featureRoutes);
app.use("/api/org-registrations", orgRegistrationRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
