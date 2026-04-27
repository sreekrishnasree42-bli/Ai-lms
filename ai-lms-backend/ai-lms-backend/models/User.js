const mongoose = require("mongoose");

/**
 * User Model
 * Fields derived from frontend Register.jsx: name, email, password
 * Extra: role (student | instructor | admin), enrolledCourses, createdAt
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [80, "Name cannot exceed 80 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // never returned in query results by default
    },
    role: {
      type: String,
      enum: ["student", "instructor", "admin"],
      default: "student",
    },

    // Courses the student has enrolled in (populated from Course._id)
    enrolledCourses: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        enrolledAt: { type: Date, default: Date.now },
      },
    ],

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
    toJSON: {
      // Strip sensitive fields when converting to JSON
      transform(_, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model("User", userSchema);
