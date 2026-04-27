const mongoose = require("mongoose");

/**
 * Quiz Model
 * Derived from:
 *   - Quiz.jsx       → POST /api/quiz  { score }
 *   - Chart.jsx      → labels ["Quiz1","Quiz2","Quiz3","Quiz4"] → multiple attempts per course
 *   - Dashboard.jsx  → data.score (average), data.completed
 */

// ── Individual question schema (for full quiz support) ─────────────────────────
const questionSchema = new mongoose.Schema({
  text:          { type: String, required: true },
  options:       [{ type: String }],           // ["A","B","C","D"]
  correctAnswer: { type: Number, default: 0 }, // index of correct option
  points:        { type: Number, default: 1 },
});

// ── Quiz attempt (one per student submission) ──────────────────────────────────
const attemptSchema = new mongoose.Schema({
  student:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  score:       { type: Number, required: true, min: 0, max: 100 },
  totalPoints: { type: Number, default: 100 },
  passed:      { type: Boolean, default: false },

  // Per-question answers submitted
  answers: [
    {
      questionIndex:  Number,
      selectedOption: Number,
      isCorrect:      Boolean,
    },
  ],

  // AI analysis stored after submission
  aiFeedback: { type: String, default: "" },

  submittedAt: { type: Date, default: Date.now },
});

// ── Main quiz schema ───────────────────────────────────────────────────────────
const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Quiz title is required"],
      trim: true,
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course reference is required"],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    questions: {
      type: [questionSchema],
      default: [],
    },

    // Minimum score percentage to pass
    passingScore: { type: Number, default: 60, min: 0, max: 100 },

    isPublished: { type: Boolean, default: true },

    // All student attempts stored here
    attempts: [attemptSchema],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

quizSchema.index({ course: 1 });
quizSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Quiz", quizSchema);
