/**
 * notFound
 * --------
 * 404 handler — catches any request that didn't match a route.
 * Register AFTER all routes.
 */
const notFound = (req, res, next) => {
  const err       = new Error(`Not Found: ${req.originalUrl}`);
  err.statusCode  = 404;
  next(err);
};

/**
 * errorHandler
 * ------------
 * Centralised error formatter.  Must be the LAST middleware registered.
 * Works with express-async-errors so async controllers don't need try/catch.
 */
const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message    = err.message    || "Internal Server Error";

  // ── Mongoose validation error ─────────────────────────────────────────────
  if (err.name === "ValidationError") {
    statusCode = 422;
    message    = Object.values(err.errors).map((e) => e.message).join(". ");
  }

  // ── Mongoose duplicate key ────────────────────────────────────────────────
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message    = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // ── Mongoose bad ObjectId ─────────────────────────────────────────────────
  if (err.name === "CastError") {
    statusCode = 400;
    message    = `Invalid ${err.path}: "${err.value}"`;
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  if (err.name === "JsonWebTokenError") { statusCode = 401; message = "Invalid token"; }
  if (err.name === "TokenExpiredError") { statusCode = 401; message = "Token expired";  }

  // ── Joi validation ────────────────────────────────────────────────────────
  if (err.isJoi) {
    statusCode = 422;
    message    = err.details.map((d) => d.message).join(". ");
  }

  // Log server-side errors in development
  if (process.env.NODE_ENV !== "production" && statusCode >= 500) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && statusCode >= 500 && {
      stack: err.stack,
    }),
  });
};

/**
 * createError — helper used inside controllers.
 * Usage:  throw createError(404, "Course not found");
 */
const createError = (statusCode, message) => {
  const err      = new Error(message);
  err.statusCode = statusCode;
  return err;
};

module.exports = { notFound, errorHandler, createError };
