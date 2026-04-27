const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/quizController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { aiLimiter }          = require("../middleware/rateLimiter");

/**
 * Quiz Routes
 * Base path: /api/quiz
 *
 * Frontend endpoints used:
 *   POST /api/quiz  → Quiz.jsx
 *     body: { score }
 *     alert: "Score saved! AI will analyze your performance."
 */

// ── Student: submit score ──────────────────────────────────────────────────
// POST /api/quiz
// Matches Quiz.jsx → axios.post("http://localhost:5000/api/quiz", { score })
// This is the primary endpoint used by the frontend.
router.post("/", protect, authorize("student"), aiLimiter, ctrl.submitQuiz);

// ── Read quizzes ────────────────────────────────────────────────────────────
// GET /api/quiz             — list quizzes (optional ?courseId=)
// GET /api/quiz/:id         — single quiz
// GET /api/quiz/:id/results — all student attempts (instructor / admin)
router.get("/",           protect, ctrl.getQuizzes);
router.get("/:id",        protect, ctrl.getQuizById);
router.get("/:id/results",protect, authorize("instructor", "admin"), ctrl.getQuizResults);

// ── Instructor / Admin: CRUD ───────────────────────────────────────────────
// POST   /api/quiz/create   — create quiz with questions
// PUT    /api/quiz/:id      — update quiz
// DELETE /api/quiz/:id      — delete quiz
router.post("/create", protect, authorize("instructor", "admin"), ctrl.createQuiz);
router.put("/:id",     protect, authorize("instructor", "admin"), ctrl.updateQuiz);
router.delete("/:id",  protect, authorize("instructor", "admin"), ctrl.deleteQuiz);

module.exports = router;
