import cors from "cors";
import express from "express";
import morgan from "morgan";
import swaggerUiDist from "swagger-ui-dist";

import openApiSpec from "./docs/openapi";
import { errorHandler, notFound } from "./middleware/error";
import authRoutes from "./routes/auth.routes";
import featureRoutes from "./routes/feature.routes";
import orgRegistrationRoutes from "./routes/orgRegistration.routes";
import organizationRoutes from "./routes/organization.routes";
import roleRoutes from "./routes/role.routes";
import userRoutes from "./routes/user.routes";

const app = express();
const swaggerAssetsPath = swaggerUiDist.getAbsoluteFSPath();

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

app.get(
  [
    "/swagger-ui.css",
    "/swagger-ui-bundle.js",
    "/swagger-ui-standalone-preset.js",
    "/favicon-16x16.png",
    "/favicon-32x32.png",
  ],
  (req, res) => {
    res.redirect(302, `/api-docs${req.path}`);
  }
);

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
    <link rel="stylesheet" href="/api-docs/swagger-ui.css" />
    <link rel="icon" href="/api-docs/favicon-32x32.png" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api-docs/swagger-ui-bundle.js"></script>
    <script src="/api-docs/swagger-ui-standalone-preset.js"></script>
    <script src="/api-docs/swagger-ui-init.js"></script>
  </body>
</html>
`);
});

app.use("/api-docs", express.static(swaggerAssetsPath, { index: false }));

app.use("/api/auth", authRoutes);
app.use("/api/features", featureRoutes);
app.use("/api/org-registrations", orgRegistrationRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
