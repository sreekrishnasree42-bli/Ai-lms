"use strict";

/**
 * server.js — AI LMS Backend
 * ──────────────────────────
 * Entry point for the Express application.
 *
 * Boot order:
 *  1. express-async-errors  — patches async errors into Express error pipeline
 *  2. dotenv                — loads .env before anything reads process.env
 *  3. connectDB             — establishes MongoDB connection
 *  4. Middleware            — CORS, body parsing, rate limiting
 *  5. Routes                — /api/register, /api/login, /api/courses, /api/quiz, /api/progress
 *  6. Error handlers        — 404 catcher → centralised error formatter
 *  7. app.listen            — start HTTP server
 */

// ── 1. Patch async errors (must be before express and routes) ─────────────────
require("express-async-errors");

// ── 2. Environment variables ──────────────────────────────────────────────────
require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const connectDB = require("./config/db");

const { apiLimiter }           = require("./middleware/rateLimiter");
const { notFound, errorHandler } = require("./middleware/errorHandler");

// ── Route modules ─────────────────────────────────────────────────────────────
const authRoutes     = require("./routes/authRoutes");
const courseRoutes   = require("./routes/courseRoutes");
const quizRoutes     = require("./routes/quizRoutes");
const progressRoutes = require("./routes/progressRoutes");

// ─────────────────────────────────────────────────────────────────────────────
// App initialisation
// ─────────────────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;
console.log("MONGO_URI:", process.env.MONGO_URI);

// ── 3. Connect to MongoDB ─────────────────────────────────────────────────────
connectDB();

// ─────────────────────────────────────────────────────────────────────────────
// 4. Global Middleware
// ─────────────────────────────────────────────────────────────────────────────

// CORS
// Reads allowed origins from CLIENT_ORIGINS env var (comma-separated).
// Falls back to the two Vite/React dev ports.
const rawOrigins = process.env.CLIENT_ORIGINS || "http://localhost:3000,http://localhost:5173";
const allowedOrigins = rawOrigins.split(",").map((o) => o.trim());

app.use(
  cors({
    origin(origin, callback) {
      // Allow REST clients (Postman, curl) that send no Origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS policy: origin "${origin}" is not allowed`));
    },
    credentials: true,
    methods:     ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "token"],
  })
);

// Body parsing (10 MB limit covers base64 images if needed)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Global API rate limiter
app.use("/api", apiLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Health / root ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "AI LMS API is running 🚀",
    version: "1.0.0",
    docs:    "See README.md for Postman collection and endpoint list",
  });
});

app.get("/api/health", (_req, res) => {
  const { connection } = require("mongoose");
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    success:   true,
    status:    "healthy",
    database:  states[connection.readyState] || "unknown",
    uptime:    `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
    ai:        process.env.ANTHROPIC_API_KEY ? "configured" : "not configured",
  });
});

// ── Auth  (POST /api/register, POST /api/login, GET /api/me, etc.) ────────────
app.use("/api", authRoutes);

// ── Courses  (GET /api/courses, GET /api/courses/:id, etc.) ──────────────────
app.use("/api/courses", courseRoutes);

// ── Quiz  (POST /api/quiz, GET /api/quiz, etc.) ───────────────────────────────
app.use("/api/quiz", quizRoutes);

// ── Progress  (GET /api/progress, POST /api/progress/complete, etc.) ─────────
app.use("/api/progress", progressRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// 6. Error handling  — must be registered AFTER all routes
// ─────────────────────────────────────────────────────────────────────────────
app.use(notFound);      // 404 for any unmatched route
app.use(errorHandler);  // central error → JSON formatter

// ─────────────────────────────────────────────────────────────────────────────
// 7. Start server
// ─────────────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║            AI LMS Backend  — Started             ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  URL      http://localhost:${PORT}                   ║`);
  console.log(`║  ENV      ${(process.env.NODE_ENV || "development").padEnd(40)}║`);
  console.log(`║  AI       ${(process.env.ANTHROPIC_API_KEY ? "✅  Anthropic API key found" : "⚠️   No ANTHROPIC_API_KEY").padEnd(40)}║`);
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  Endpoints                                        ║");
  console.log("║    POST  /api/register                            ║");
  console.log("║    POST  /api/login                               ║");
  console.log("║    GET   /api/courses                             ║");
  console.log("║    GET   /api/courses/:id                         ║");
  console.log("║    POST  /api/quiz          (submit score)        ║");
  console.log("║    GET   /api/progress      (dashboard data)      ║");
  console.log("║    GET   /api/health                              ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");
});

// ─────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n⚠️  ${signal} received — shutting down gracefully...`);
  server.close(async () => {
    try {
      await require("mongoose").connection.close();
      console.log("✅  MongoDB connection closed");
    } catch (_) {}
    console.log("✅  HTTP server closed");
    process.exit(0);
  });

  // Force-kill if graceful shutdown takes too long
  setTimeout(() => {
    console.error("❌  Forced shutdown after 10s timeout");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("❌  Unhandled Rejection:", reason);
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (err) => {
  console.error("❌  Uncaught Exception:", err.message);
  shutdown("uncaughtException");
});

// Export for testing
module.exports = app;
