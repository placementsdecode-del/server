import type { Request, Response } from "express";

import app from "../src/app";
import connectDB from "../src/config/db";

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
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error("Vercel handler failed:", error);
    return res.status(500).json({
      message: "Server failed before request handling",
    });
  }
}
