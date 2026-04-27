const Quiz      = require("../models/Quiz");
const Progress  = require("../models/Progress");
const Course    = require("../models/Course");
const Anthropic = require("@anthropic-ai/sdk").default;
const { createError } = require("../middleware/errorHandler");

// ── AI client (lazy-init so missing key doesn't crash startup) ─────────────────
const getAI = () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw createError(503, "AI service is not configured (ANTHROPIC_API_KEY missing)");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quiz
// Returns all quizzes (filtered by course if ?courseId= is supplied).
// ─────────────────────────────────────────────────────────────────────────────
const getQuizzes = async (req, res) => {
  const filter = {};
  if (req.query.courseId) filter.course = req.query.courseId;

  // Students only see published quizzes
  if (req.user.role === "student") {
    filter.isPublished = true;
    // Hide correct answers from students
    const quizzes = await Quiz.find(filter)
      .populate("course", "title")
      .select("-questions.correctAnswer -attempts.answers");
    return res.json({ success: true, quizzes });
  }

  const quizzes = await Quiz.find(filter).populate("course", "title").sort({ createdAt: -1 });
  res.json({ success: true, quizzes });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quiz/:id
// ─────────────────────────────────────────────────────────────────────────────
const getQuizById = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
    .populate("course", "title")
    .populate("createdBy", "name");

  if (!quiz) throw createError(404, "Quiz not found");

  // Students see questions without correct answers
  if (req.user.role === "student") {
    const safe = quiz.toObject();
    safe.questions = safe.questions.map(({ _id, text, options, points }) =>
      ({ _id, text, options, points })
    );
    delete safe.attempts;
    return res.json({ success: true, quiz: safe });
  }

  res.json({ success: true, quiz });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz
// Matches: Quiz.jsx → axios.post("http://localhost:5000/api/quiz", { score })
//
// The frontend sends { score } (a raw number 0–100).
// We store it, recalculate progress averages, and run AI feedback.
// ─────────────────────────────────────────────────────────────────────────────
const submitQuiz = async (req, res) => {
  const { score, quizId, courseId, answers = [], timeTaken = 0 } = req.body;

  // score is the minimum required field (matches the frontend exactly)
  if (score === undefined || score === null) {
    throw createError(400, "score is required");
  }
  if (typeof score !== "number" || score < 0 || score > 100) {
    throw createError(422, "score must be a number between 0 and 100");
  }

  // ── Resolve quiz document (optional — frontend doesn't send quizId) ────────
  let quiz = null;
  if (quizId) {
    quiz = await Quiz.findById(quizId);
    if (!quiz) throw createError(404, "Quiz not found");
  }

  const passed       = score >= (quiz?.passingScore ?? 60);
  const totalPoints  = 100;

  // ── If a real quiz, grade per-question answers ─────────────────────────────
  let gradedAnswers = [];
  if (quiz && answers.length > 0) {
    gradedAnswers = quiz.questions.map((q, i) => {
      const submitted = answers.find((a) => a.questionIndex === i);
      const selected  = submitted?.selectedOption ?? -1;
      return {
        questionIndex:  i,
        selectedOption: selected,
        isCorrect:      selected === q.correctAnswer,
      };
    });

    // Push attempt into Quiz document
    quiz.attempts.push({
      student:     req.user._id,
      score,
      totalPoints,
      passed,
      answers:     gradedAnswers,
    });
    await quiz.save();
  }

  // ── Update Progress document ───────────────────────────────────────────────
  let progress = await Progress.findOne({ student: req.user._id });
  if (!progress) {
    progress = await Progress.create({ student: req.user._id });
  }

  // Push new quiz score
  progress.quizScores.push({
    quiz:   quiz?._id,
    course: courseId || quiz?.course,
    score,
    passed,
  });

  progress.recalculate();

  // ── AI feedback (non-blocking — if AI fails, still return success) ─────────
  let aiFeedback = "";
  try {
    const ai = getAI();
    const context = quiz
      ? `Quiz: "${quiz.title}", Course: "${quiz.course}", Score: ${score}/100 (${passed ? "PASSED" : "FAILED"})`
      : `Raw score submitted: ${score}/100`;

    const msg = await ai.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `A student just completed a quiz. Give ONE sentence of encouragement and ONE specific study tip.\n\n${context}\nAll scores history: ${JSON.stringify(progress.quizScores.slice(-5).map(s => s.score))}`,
      }],
    });

    aiFeedback = msg.content?.[0]?.text ?? "";

    // Store feedback on the most recent attempt
    if (quiz && quiz.attempts.length > 0) {
      quiz.attempts[quiz.attempts.length - 1].aiFeedback = aiFeedback;
      await quiz.save();
    }
  } catch (aiErr) {
    console.warn("AI feedback skipped:", aiErr.message);
    aiFeedback = passed
      ? "Great job! Keep up the excellent work."
      : "Good effort! Review the material and try again.";
  }

  // Update recommendation on progress
  progress.recommendation = aiFeedback || progress.recommendation;
  await progress.save();

  // ── Response ───────────────────────────────────────────────────────────────
  res.status(201).json({
    success: true,
    message: "Score saved! AI will analyse your performance.",
    result: {
      score,
      passed,
      averageScore:   progress.averageScore,
      aiFeedback,
      gradedAnswers:  gradedAnswers.length ? gradedAnswers : undefined,
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/create  — instructor / admin creates a quiz
// ─────────────────────────────────────────────────────────────────────────────
const createQuiz = async (req, res) => {
  const { title, courseId, questions, passingScore, isPublished } = req.body;

  if (!title || !courseId) throw createError(400, "title and courseId are required");

  const course = await Course.findById(courseId);
  if (!course) throw createError(404, "Course not found");

  // Instructors can only add quizzes to their own courses
  if (req.user.role === "instructor" && course.instructor.toString() !== req.user._id.toString()) {
    throw createError(403, "You can only add quizzes to your own courses");
  }

  const quiz = await Quiz.create({
    title,
    course:      courseId,
    createdBy:   req.user._id,
    questions:   questions   || [],
    passingScore: passingScore ?? 60,
    isPublished: isPublished ?? true,
  });

  res.status(201).json({ success: true, message: "Quiz created", quiz });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/quiz/:id  — instructor (own) or admin
// ─────────────────────────────────────────────────────────────────────────────
const updateQuiz = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw createError(404, "Quiz not found");

  const isOwner = quiz.createdBy.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== "admin") throw createError(403, "Not authorised");

  const fields = ["title", "questions", "passingScore", "isPublished"];
  fields.forEach((f) => { if (req.body[f] !== undefined) quiz[f] = req.body[f]; });
  await quiz.save();

  res.json({ success: true, message: "Quiz updated", quiz });
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/quiz/:id  — instructor (own) or admin
// ─────────────────────────────────────────────────────────────────────────────
const deleteQuiz = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw createError(404, "Quiz not found");

  const isOwner = quiz.createdBy.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== "admin") throw createError(403, "Not authorised");

  await Quiz.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: "Quiz deleted" });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quiz/:id/results  — instructor / admin: see all attempts
// ─────────────────────────────────────────────────────────────────────────────
const getQuizResults = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id)
    .populate("attempts.student", "name email")
    .populate("course", "title");
  if (!quiz) throw createError(404, "Quiz not found");

  res.json({ success: true, quiz });
};

module.exports = {
  getQuizzes, getQuizById,
  submitQuiz, createQuiz, updateQuiz, deleteQuiz,
  getQuizResults,
};
