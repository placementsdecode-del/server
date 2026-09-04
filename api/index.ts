import type { Request, Response } from "express";

import app from "../src/app";
import connectDB from "../src/config/db";

const publicRoutesWithoutDatabase = new Set([
  "/",
  "/health",
  "/api/health",
  "/openapi.json",
  "/api-docs",
  "/api-docs/",
  "/api-docs/swagger-ui-init.js",
  "/swagger-ui-init.js",
]);

function applyCorsHeaders(req: Request, res: Response) {
  const origin = req.headers.origin || "*";

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] || "Content-Type, Authorization"
  );
}

export default async function handler(req: Request, res: Response) {
  applyCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    if (!publicRoutesWithoutDatabase.has(req.url || "")) {
      await connectDB();
    }

    return app(req, res);
  } catch (error) {
    console.error("Vercel handler failed:", error);
    const message = error instanceof Error ? error.message : "Unknown startup error";

    return res.status(500).json({
      message: "Server failed before request handling",
      error: process.env.NODE_ENV === "production" && message !== "MONGODB_URI is required" ? "Database connection failed" : message,
    });
  }
}
