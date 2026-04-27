const express  = require("express");
const router   = express.Router();
const ctrl     = require("../controllers/authController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { authLimiter }        = require("../middleware/rateLimiter");

/**
 * Auth Routes
 * Base path: /api
 *
 * Frontend endpoints used:
 *   POST /api/register  → Register.jsx
 *   POST /api/login     → Login.jsx
 */

// ── Public ─────────────────────────────────────────────────────────────────
// POST /api/register  — matches Register.jsx exactly
router.post("/register", authLimiter, ctrl.register);

// POST /api/login  — matches Login.jsx exactly
router.post("/login", authLimiter, ctrl.login);

// ── Authenticated ──────────────────────────────────────────────────────────
// GET /api/me  — returns current user profile
router.get("/me", protect, ctrl.getMe);

// ── Admin only ─────────────────────────────────────────────────────────────
// GET    /api/users          — list all users (with optional ?role= filter)
// PUT    /api/users/:id      — update name / role
// DELETE /api/users/:id      — delete user
router.get("/users",    protect, authorize("admin"), ctrl.getUsers);
router.put("/users/:id", protect, ctrl.updateUser);                    // self or admin
router.delete("/users/:id", protect, authorize("admin"), ctrl.deleteUser);

module.exports = router;
