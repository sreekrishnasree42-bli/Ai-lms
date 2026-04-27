const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/progressController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { aiLimiter }          = require("../middleware/rateLimiter");

/**
 * Progress Routes
 * Base path: /api/progress
 *
 * Frontend endpoints used:
 *   GET /api/progress  → Dashboard.jsx
 *     headers: { Authorization: localStorage.getItem("token") }
 *     response: { completed, score, recommendation }
 */

// ── Student ─────────────────────────────────────────────────────────────────
// GET /api/progress
// Matches Dashboard.jsx exactly → returns { completed, score, recommendation }
router.get("/", protect, ctrl.getProgress);

// POST /api/progress/complete  — mark a course as completed
// body: { courseId }
router.post("/complete", protect, authorize("student"), ctrl.markCourseComplete);

// POST /api/progress/ai-recommendation  — refresh AI recommendation
router.post(
  "/ai-recommendation",
  protect,
  authorize("student"),
  aiLimiter,
  ctrl.refreshRecommendation
);

// ── Admin ───────────────────────────────────────────────────────────────────
// GET /api/progress/all  — all students' progress (admin only)
router.get("/all", protect, authorize("admin"), ctrl.getAllProgress);

module.exports = router;
