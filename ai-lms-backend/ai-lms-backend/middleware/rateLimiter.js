const rateLimit = require("express-rate-limit");

/**
 * authLimiter — strict limit for login/register endpoints
 * 30 requests per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests — please wait 15 minutes and try again.",
  },
});

/**
 * apiLimiter — general limit for all API routes
 * 300 requests per 10 minutes per IP
 */
const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests — please slow down.",
  },
});

/**
 * aiLimiter — strict limit for AI endpoints (Anthropic API costs money)
 * 20 requests per hour per IP
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "AI request limit reached — please wait an hour.",
  },
});

module.exports = { authLimiter, apiLimiter, aiLimiter };
