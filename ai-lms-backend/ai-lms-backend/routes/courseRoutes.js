const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/courseController");
const { protect, authorize } = require("../middleware/authMiddleware");

/**
 * Course Routes
 * Base path: /api/courses
 *
 * Frontend endpoints used:
 *   GET /api/courses        → Courses.jsx
 *   GET /api/courses/:id    → CourseDetails.jsx
 */

// ── Public (no auth required to browse) ───────────────────────────────────
// GET /api/courses          — list all published courses
// Matches: Courses.jsx → axios.get("http://localhost:5000/api/courses")
router.get("/", ctrl.getCourses);

// GET /api/courses/my       — instructor: own courses (must come before /:id)
router.get("/my", protect, authorize("instructor", "admin"), ctrl.getMyCourses);

// GET /api/courses/:id      — single course detail
// Matches: CourseDetails.jsx → axios.get(`http://localhost:5000/api/courses/${id}`)
router.get("/:id", protect, ctrl.getCourseById);

// ── Instructor / Admin: CRUD ───────────────────────────────────────────────
// POST   /api/courses         — create course
// PUT    /api/courses/:id     — update course
// DELETE /api/courses/:id     — delete course
router.post("/",    protect, authorize("instructor", "admin"), ctrl.createCourse);
router.put("/:id",  protect, authorize("instructor", "admin"), ctrl.updateCourse);
router.delete("/:id", protect, authorize("instructor", "admin"), ctrl.deleteCourse);

// ── Student: enroll ────────────────────────────────────────────────────────
// POST /api/courses/:id/enroll  — student enrolls in a course
router.post("/:id/enroll", protect, authorize("student"), ctrl.enrollCourse);

module.exports = router;
