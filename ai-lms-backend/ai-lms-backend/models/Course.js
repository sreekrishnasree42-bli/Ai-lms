const mongoose = require("mongoose");

/**
 * Course Model
 * Fields derived from:
 *   - Courses.jsx        → title, _id
 *   - CourseCard.jsx     → title, description, _id
 *   - CourseDetails.jsx  → title, description, videoUrl, recommendation
 */
const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      minlength: [5, "Title must be at least 5 characters"],
      maxlength: [150, "Title cannot exceed 150 characters"],
    },

    description: {
      type: String,
      required: [true, "Description is required"],
      minlength: [10, "Description must be at least 10 characters"],
    },

    // URL of video hosted externally (YouTube embed, S3, etc.)
    videoUrl: {
      type: String,
      default: "",
    },

    // Thumbnail image URL for course card display
    thumbnail: {
      type: String,
      default: "",
    },

    // Who created this course
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Instructor is required"],
    },

    // Category / tag (e.g. "Web Dev", "Data Science")
    category: {
      type: String,
      default: "General",
      trim: true,
    },

    // Difficulty level
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },

    // Whether this course is visible to students
    isPublished: { type: Boolean, default: false },

    // Student IDs enrolled in this course
    enrolledStudents: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],

    // AI-generated course recommendation / suggestion shown in CourseDetails
    recommendation: {
      type: String,
      default: "Keep learning!",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtual: how many students enrolled
courseSchema.virtual("studentCount").get(function () {
  return this.enrolledStudents.length;
});

// Full-text search index
courseSchema.index({ title: "text", description: "text", category: "text" });
courseSchema.index({ instructor: 1 });
courseSchema.index({ isPublished: 1 });

module.exports = mongoose.model("Course", courseSchema);
