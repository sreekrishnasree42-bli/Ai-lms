/**
 * Seed script — run once to populate demo data.
 * Usage: node utils/seed.js
 */
require("dotenv").config();
const mongoose  = require("mongoose");
const bcrypt    = require("bcryptjs");
const connectDB = require("../config/db");
const User      = require("../models/User");
const Course    = require("../models/Course");
const Quiz      = require("../models/Quiz");
const Progress  = require("../models/Progress");

const seed = async () => {
  await connectDB();

  // ── Clean existing data ──────────────────────────────────────────────────
  await Promise.all([
    User.deleteMany({}),
    Course.deleteMany({}),
    Quiz.deleteMany({}),
    Progress.deleteMany({}),
  ]);
  console.log("🗑️  Cleared existing data");

  // ── Users ────────────────────────────────────────────────────────────────
  const hash = async (pw) => bcrypt.hash(pw, 12);

  const admin = await User.create({
    name: "Admin User", email: "admin@ailms.com",
    password: await hash("password123"), role: "admin",
  });

  const instructor = await User.create({
    name: "Dr. Jane Smith", email: "instructor@ailms.com",
    password: await hash("password123"), role: "instructor",
  });

  const student = await User.create({
    name: "John Doe", email: "student@ailms.com",
    password: await hash("password123"), role: "student",
  });

  console.log("👥  Users created");

  // ── Courses ──────────────────────────────────────────────────────────────
  const course1 = await Course.create({
    title: "Introduction to React",
    description: "Learn React from scratch — hooks, state, and component patterns.",
    videoUrl: "https://www.youtube.com/embed/bMknfKXIFA8",
    category: "Web Development",
    level: "Beginner",
    instructor: instructor._id,
    isPublished: true,
    enrolledStudents: [student._id],
    recommendation: "Great course for beginners! Focus on useEffect and useState.",
  });

  const course2 = await Course.create({
    title: "Node.js & Express Fundamentals",
    description: "Build REST APIs with Node.js, Express, and MongoDB.",
    videoUrl: "https://www.youtube.com/embed/Oe421EPjeBE",
    category: "Backend Development",
    level: "Intermediate",
    instructor: instructor._id,
    isPublished: true,
    enrolledStudents: [student._id],
    recommendation: "Excellent for aspiring backend developers!",
  });

  const course3 = await Course.create({
    title: "Machine Learning Basics",
    description: "Understand supervised learning, regression, and classification.",
    videoUrl: "",
    category: "Data Science",
    level: "Advanced",
    instructor: instructor._id,
    isPublished: true,
    recommendation: "Master Python fundamentals before taking this course.",
  });

  console.log("📚  Courses created");

  // ── Quizzes ──────────────────────────────────────────────────────────────
  const quiz1 = await Quiz.create({
    title: "Quiz 1 — React Basics",
    course: course1._id,
    createdBy: instructor._id,
    passingScore: 60,
    questions: [
      { text: "What hook manages state in React?",       options: ["useRef","useState","useEffect","useContext"], correctAnswer: 1, points: 25 },
      { text: "Which lifecycle does useEffect replace?", options: ["constructor","componentDidMount","render","shouldUpdate"], correctAnswer: 1, points: 25 },
      { text: "JSX stands for?",                         options: ["Java Syntax Extension","JavaScript XML","JSON Extension","None"], correctAnswer: 1, points: 25 },
      { text: "React was made by?",                      options: ["Google","Microsoft","Facebook","Netflix"], correctAnswer: 2, points: 25 },
    ],
    attempts: [
      { student: student._id, score: 75, totalPoints: 100, passed: true,  submittedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
    ],
  });

  const quiz2 = await Quiz.create({
    title: "Quiz 2 — Hooks Deep Dive",
    course: course1._id,
    createdBy: instructor._id,
    passingScore: 60,
    questions: [
      { text: "useCallback returns a memoised?", options: ["value","function","array","object"], correctAnswer: 1, points: 50 },
      { text: "useMemo is used for?",            options: ["side effects","memoising values","HTTP calls","routing"], correctAnswer: 1, points: 50 },
    ],
    attempts: [
      { student: student._id, score: 50, totalPoints: 100, passed: false, submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
    ],
  });

  const quiz3 = await Quiz.create({
    title: "Quiz 3 — Node.js Basics",
    course: course2._id,
    createdBy: instructor._id,
    passingScore: 60,
    questions: [
      { text: "Express is a?",          options: ["database","framework","language","cloud service"], correctAnswer: 1, points: 50 },
      { text: "app.listen() does what?",options: ["connects DB","starts server","reads file","none"], correctAnswer: 1, points: 50 },
    ],
    attempts: [
      { student: student._id, score: 80, totalPoints: 100, passed: true, submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    ],
  });

  const quiz4 = await Quiz.create({
    title: "Quiz 4 — REST APIs",
    course: course2._id,
    createdBy: instructor._id,
    passingScore: 60,
    questions: [
      { text: "HTTP verb for creating a resource?", options: ["GET","DELETE","POST","PUT"], correctAnswer: 2, points: 50 },
      { text: "Status code for 'Not Found'?",       options: ["200","401","404","500"], correctAnswer: 2, points: 50 },
    ],
    attempts: [
      { student: student._id, score: 90, totalPoints: 100, passed: true, submittedAt: new Date() },
    ],
  });

  console.log("❓  Quizzes created");

  // ── Progress ─────────────────────────────────────────────────────────────
  await Progress.create({
    student: student._id,
    courses: [
      { course: course1._id, completed: true,  completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { course: course2._id, completed: false },
    ],
    quizScores: [
      { quiz: quiz1._id, course: course1._id, score: 75, passed: true,  attemptedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
      { quiz: quiz2._id, course: course1._id, score: 50, passed: false, attemptedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
      { quiz: quiz3._id, course: course2._id, score: 80, passed: true,  attemptedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { quiz: quiz4._id, course: course2._id, score: 90, passed: true,  attemptedAt: new Date() },
    ],
    completedCount: 1,
    averageScore: 74,
    recommendation: "You're doing great! Review Quiz 2 on React Hooks to improve your score. Consider starting the Machine Learning course next.",
  });

  // Enrol student
  await User.findByIdAndUpdate(student._id, {
    enrolledCourses: [
      { course: course1._id },
      { course: course2._id },
    ],
  });

  console.log("📊  Progress created");

  console.log("\n✅  Seed complete!\n");
  console.log("┌─────────────────────────────────────────┐");
  console.log("│          Demo Login Credentials         │");
  console.log("├─────────────────────────────────────────┤");
  console.log("│  Admin:      admin@ailms.com            │");
  console.log("│  Instructor: instructor@ailms.com       │");
  console.log("│  Student:    student@ailms.com          │");
  console.log("│  Password:   password123 (all accounts) │");
  console.log("└─────────────────────────────────────────┘");

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
