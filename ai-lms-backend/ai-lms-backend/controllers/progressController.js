const Progress  = require("../models/Progress");
const Course    = require("../models/Course");
const Quiz      = require("../models/Quiz");
// const Anthropic = require("anthropic");
const { createError } = require("../middleware/errorHandler");

const getAI = () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw createError(503, "AI service not configured");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/progress
// Matches Dashboard.jsx:
//   axios.get("http://localhost:5000/api/progress", { headers: { Authorization: token } })
//   → setData(res.data)
//   → data.completed, data.score, data.recommendation
//
// The response root level has { completed, score, recommendation }
// so that Dashboard.jsx destructures correctly without any changes.
// ─────────────────────────────────────────────────────────────────────────────
const getProgress = async (req, res) => {
  let progress = await Progress.findOne({ student: req.user._id })
    .populate("courses.course",     "title thumbnail category")
    .populate("quizScores.quiz",    "title passingScore")
    .populate("quizScores.course",  "title");

  // Auto-create if missing (happens if student registered before seed)
  if (!progress) {
    progress = await Progress.create({ student: req.user._id });
  }

  // Build chart data array for Chart.jsx (labels: Quiz1–Quiz4)
  const chartScores = progress.quizScores.slice(-4).map((q) => q.score);

  // ── Response shape exactly matches what Dashboard.jsx expects ──────────────
  res.json({
    // Top-level fields used by Dashboard.jsx
    completed:      progress.completedCount,
    score:          progress.averageScore,
    recommendation: progress.recommendation,

    // Extra detail for richer UIs
    courses:        progress.courses,
    quizScores:     progress.quizScores,
    chartScores,    // [75, 50, 80, 90] — used by Chart.jsx
    totalQuizzes:   progress.quizScores.length,
    lastUpdated:    progress.updatedAt,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/progress/all  — admin: all students' progress
// ─────────────────────────────────────────────────────────────────────────────
const getAllProgress = async (req, res) => {
  const progress = await Progress.find()
    .populate("student", "name email")
    .select("student completedCount averageScore recommendation updatedAt")
    .sort({ updatedAt: -1 });

  res.json({ success: true, progress });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/progress/complete
// Body: { courseId }
// Marks a course as completed in the student's progress record.
// ─────────────────────────────────────────────────────────────────────────────
const markCourseComplete = async (req, res) => {
  const { courseId } = req.body;
  if (!courseId) throw createError(400, "courseId is required");

  const course = await Course.findById(courseId);
  if (!course) throw createError(404, "Course not found");

  let progress = await Progress.findOne({ student: req.user._id });
  if (!progress) {
    progress = await Progress.create({ student: req.user._id });
  }

  const entry = progress.courses.find((c) => c.course.toString() === courseId);
  if (entry) {
    entry.completed   = true;
    entry.completedAt = new Date();
  } else {
    progress.courses.push({ course: courseId, completed: true, completedAt: new Date() });
  }

  progress.recalculate();
  await progress.save();

  res.json({
    success: true,
    message: "Course marked as completed",
    completed: progress.completedCount,
    score:     progress.averageScore,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/progress/ai-recommendation
// Triggers a fresh AI recommendation for the logged-in student.
// ─────────────────────────────────────────────────────────────────────────────
const refreshRecommendation = async (req, res) => {
  let progress = await Progress.findOne({ student: req.user._id })
    .populate("courses.course",  "title category level")
    .populate("quizScores.quiz", "title");

  if (!progress) throw createError(404, "No progress record found");

  const ai = getAI();

  // Build a concise summary for Claude
  const completedCourses = progress.courses.filter((c) => c.completed).map((c) => c.course?.title).join(", ") || "none";
  const inProgressCourses = progress.courses.filter((c) => !c.completed).map((c) => c.course?.title).join(", ") || "none";
  const recentScores      = progress.quizScores.slice(-5).map((q) => `${q.quiz?.title || "Quiz"}: ${q.score}%`).join(", ") || "no quizzes taken";

  const prompt = `You are an AI learning coach for an online LMS platform.
Student summary:
- Courses completed: ${completedCourses}
- Courses in progress: ${inProgressCourses}
- Recent quiz scores: ${recentScores}
- Average score: ${progress.averageScore}%
- Total quizzes taken: ${progress.quizScores.length}

Write a personalised recommendation (2-3 sentences) to help this student improve. Be specific, encouraging, and actionable.`;

  let recommendation = "";
  try {
    const msg = await ai.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 250,
      messages:   [{ role: "user", content: prompt }],
    });
    recommendation = msg.content?.[0]?.text ?? "";
  } catch (err) {
    console.warn("AI recommendation error:", err.message);
    recommendation = progress.averageScore >= 70
      ? "You're doing well! Challenge yourself with advanced courses and aim for perfect scores."
      : "Keep practising! Review incorrect quiz answers and revisit course materials before retrying.";
  }

  progress.recommendation          = recommendation;
  progress.recommendationUpdatedAt = new Date();
  await progress.save();

  res.json({
    success: true,
    recommendation,
    score:     progress.averageScore,
    completed: progress.completedCount,
  });
};

module.exports = {
  getProgress, getAllProgress,
  markCourseComplete, refreshRecommendation,
};
