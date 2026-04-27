const mongoose = require("mongoose");

/**
 * Progress Model
 * Derived from Dashboard.jsx:
 *   GET /api/progress → { completed, score, recommendation }
 *
 * One progress document per student — aggregates all courses & quiz scores.
 */
const progressSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one progress doc per student
    },

    // ── Per-course progress ─────────────────────────────────────────────────
    courses: [
      {
        course:      { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        completed:   { type: Boolean, default: false },
        completedAt: { type: Date },
        // Lesson IDs or indices the student has watched/completed
        completedLessons: [{ type: String }],
      },
    ],

    // ── Quiz scores history (used by Chart.jsx) ─────────────────────────────
    quizScores: [
      {
        quiz:        { type: mongoose.Schema.Types.ObjectId, ref: "Quiz" },
        course:      { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        score:       { type: Number, min: 0, max: 100 },
        passed:      { type: Boolean, default: false },
        attemptedAt: { type: Date, default: Date.now },
      },
    ],

    // ── Aggregated stats (recalculated on each quiz submission) ────────────
    // Number of courses fully completed  → Dashboard: data.completed
    completedCount: { type: Number, default: 0 },

    // Average quiz score across all attempts → Dashboard: data.score
    averageScore: { type: Number, default: 0 },

    // AI-generated personalised recommendation → Dashboard: data.recommendation
    recommendation: {
      type: String,
      default: "Complete more courses and quizzes to get personalised AI recommendations!",
    },

    // When AI last refreshed the recommendation
    recommendationUpdatedAt: { type: Date },
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

// ── Instance method: recalculate aggregate stats ───────────────────────────────
progressSchema.methods.recalculate = function () {
  // completed count
  this.completedCount = this.courses.filter((c) => c.completed).length;

  // average score
  if (this.quizScores.length > 0) {
    const total = this.quizScores.reduce((sum, q) => sum + q.score, 0);
    this.averageScore = Math.round(total / this.quizScores.length);
  } else {
    this.averageScore = 0;
  }
};

progressSchema.index({ student: 1 });

module.exports = mongoose.model("Progress", progressSchema);
