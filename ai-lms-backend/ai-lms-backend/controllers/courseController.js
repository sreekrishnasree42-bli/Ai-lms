const Course   = require("../models/Course");
const User     = require("../models/User");
const Progress = require("../models/Progress");
const { createError } = require("../middleware/errorHandler");

// ─── Helper ───────────────────────────────────────────────────────────────────
const isOwnerOrAdmin = (course, user) =>
  user.role === "admin" ||
  course.instructor.toString() === user._id.toString();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/courses
// Matches: Courses.jsx → axios.get("http://localhost:5000/api/courses")
// Returns: array of courses  → courses.map(course => course.title / course.id)
// ─────────────────────────────────────────────────────────────────────────────
const getCourses = async (req, res) => {
  const { search, category, level, page = 1, limit = 20 } = req.query;

  // Only return published courses to students
  const filter = req.user?.role === "student" || !req.user
    ? { isPublished: true }
    : {};

  if (search)   filter.$text    = { $search: search };
  if (category) filter.category = { $regex: category, $options: "i" };
  if (level)    filter.level    = level;

  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const total = await Course.countDocuments(filter);

  const courses = await Course.find(filter)
    .populate("instructor", "name email")
    .select("-enrolledStudents")    // trim payload — list view doesn't need this
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.json({ success: true, total, page: parseInt(page), courses });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/courses/:id
// Matches: CourseDetails.jsx → axios.get(`/api/courses/${id}`)
// Returns: { title, description, videoUrl, recommendation }
// ─────────────────────────────────────────────────────────────────────────────
const getCourseById = async (req, res) => {
  const course = await Course.findById(req.params.id)
    .populate("instructor", "name email")
    .populate("enrolledStudents", "name email");

  if (!course) throw createError(404, "Course not found");

  // Non-enrolled students only see public fields (no video)
  const isEnrolled = req.user && course.enrolledStudents.some(
    (s) => s._id.toString() === req.user._id.toString()
  );
  const isOwner = req.user && isOwnerOrAdmin(course, req.user);

  if (!isEnrolled && !isOwner) {
    return res.json({
      success: true,
      enrolled: false,
      course: {
        _id:        course._id,
        title:      course.title,
        description: course.description,
        category:   course.category,
        level:      course.level,
        thumbnail:  course.thumbnail,
        instructor: course.instructor,
        recommendation: course.recommendation,
        // videoUrl deliberately hidden for non-enrolled users
      },
    });
  }

  res.json({ success: true, enrolled: isEnrolled, course });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/courses  — instructor / admin only
// Body: { title, description, videoUrl, category, level, thumbnail }
// ─────────────────────────────────────────────────────────────────────────────
const createCourse = async (req, res) => {
  const { title, description, videoUrl, category, level, thumbnail, isPublished } = req.body;

  if (!title || !description) {
    throw createError(400, "Title and description are required");
  }

  const course = await Course.create({
    title: title.trim(),
    description: description.trim(),
    videoUrl:    videoUrl    || "",
    category:    category    || "General",
    level:       level       || "Beginner",
    thumbnail:   thumbnail   || "",
    isPublished: isPublished ?? false,
    instructor:  req.user._id,
  });

  res.status(201).json({ success: true, message: "Course created", course });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/courses/:id  — instructor (own) or admin
// ─────────────────────────────────────────────────────────────────────────────
const updateCourse = async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw createError(404, "Course not found");
  if (!isOwnerOrAdmin(course, req.user)) throw createError(403, "Not authorised to edit this course");

  const fields = ["title", "description", "videoUrl", "category", "level", "thumbnail", "isPublished", "recommendation"];
  fields.forEach((f) => { if (req.body[f] !== undefined) course[f] = req.body[f]; });

  await course.save();
  res.json({ success: true, message: "Course updated", course });
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/courses/:id  — instructor (own) or admin
// ─────────────────────────────────────────────────────────────────────────────
const deleteCourse = async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw createError(404, "Course not found");
  if (!isOwnerOrAdmin(course, req.user)) throw createError(403, "Not authorised to delete this course");

  await Course.findByIdAndDelete(req.params.id);
  // Clean up progress records referencing this course
  await Progress.updateMany({}, { $pull: { courses: { course: course._id }, quizScores: { course: course._id } } });

  res.json({ success: true, message: "Course deleted" });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/courses/:id/enroll  — student only
// ─────────────────────────────────────────────────────────────────────────────
const enrollCourse = async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course)            throw createError(404, "Course not found");
  if (!course.isPublished) throw createError(400, "Course is not published yet");

  const alreadyEnrolled = course.enrolledStudents.some(
    (id) => id.toString() === req.user._id.toString()
  );
  if (alreadyEnrolled) throw createError(409, "Already enrolled in this course");

  // Add student to course
  course.enrolledStudents.push(req.user._id);
  await course.save();

  // Add course to user's enrolledCourses
  await User.findByIdAndUpdate(req.user._id, {
    $push: { enrolledCourses: { course: course._id } },
  });

  // Add course to progress record
  const progress = await Progress.findOne({ student: req.user._id });
  if (progress) {
    const alreadyTracked = progress.courses.some(
      (c) => c.course.toString() === course._id.toString()
    );
    if (!alreadyTracked) {
      progress.courses.push({ course: course._id });
      await progress.save();
    }
  }

  res.json({ success: true, message: "Enrolled successfully", course });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/courses/my  — instructor sees own courses
// ─────────────────────────────────────────────────────────────────────────────
const getMyCourses = async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { instructor: req.user._id };
  const courses = await Course.find(filter)
    .populate("instructor", "name")
    .sort({ createdAt: -1 });
  res.json({ success: true, courses });
};

module.exports = {
  getCourses, getCourseById,
  createCourse, updateCourse, deleteCourse,
  enrollCourse, getMyCourses,
};
