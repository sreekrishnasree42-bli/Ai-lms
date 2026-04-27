const bcrypt        = require("bcryptjs");
const User          = require("../models/User");
const Progress      = require("../models/Progress");
const generateToken = require("../utils/generateToken");
const { createError } = require("../middleware/errorHandler");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/register
// Body: { name, email, password }
// Matches: Register.jsx → axios.post("http://localhost:5000/api/register", form)
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  // ── Basic validation ───────────────────────────────────────────────────────
  if (!name || !email || !password) {
    throw createError(400, "Name, email, and password are required");
  }
  if (password.length < 6) {
    throw createError(422, "Password must be at least 6 characters");
  }

  // ── Check duplicate email ──────────────────────────────────────────────────
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw createError(409, "Email is already registered");

  // ── Hash password ──────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash(password, 12);

  // ── Create user ────────────────────────────────────────────────────────────
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    role: role || "student",
  });

  // ── Create empty progress record for students ──────────────────────────────
  if (user.role === "student") {
    await Progress.create({ student: user._id });
  }

  const token = generateToken(user);

  // ── Response matches what Login.jsx expects: { token } ────────────────────
  res.status(201).json({
    success: true,
    message: "Registered successfully",
    token,
    user: {
      id:    user._id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/login
// Body: { email, password }
// Matches: Login.jsx → axios.post("http://localhost:5000/api/login", { email, password })
// Returns: { token }  → localStorage.setItem("token", res.data.token)
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw createError(400, "Email and password are required");
  }

  // ── Find user (include password for comparison) ────────────────────────────
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user) throw createError(401, "Invalid email or password");

  if (!user.isActive) {
    throw createError(403, "Account deactivated — contact support");
  }

  // ── Compare password ───────────────────────────────────────────────────────
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw createError(401, "Invalid email or password");

  const token = generateToken(user);

  // ── { token } is what the frontend reads: res.data.token ──────────────────
  res.json({
    success: true,
    message: "Login successful",
    token,
    user: {
      id:    user._id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/me
// Returns the currently authenticated user's profile.
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate("enrolledCourses.course", "title thumbnail category");

  if (!user) throw createError(404, "User not found");
  res.json({ success: true, user });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users  — admin: list all users
// ─────────────────────────────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  const { role, search, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (role)   filter.role = role;
  if (search) filter.$or  = [
    { name:  { $regex: search, $options: "i" } },
    { email: { $regex: search, $options: "i" } },
  ];

  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.json({ success: true, total, page: parseInt(page), users });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/users/:id  — update name/role
// ─────────────────────────────────────────────────────────────────────────────
const updateUser = async (req, res) => {
  // Only allow self-update OR admin
  if (req.user.role !== "admin" && req.user._id.toString() !== req.params.id) {
    throw createError(403, "Forbidden");
  }

  const allowed = ["name"];
  if (req.user.role === "admin") allowed.push("role", "isActive");

  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!user) throw createError(404, "User not found");

  res.json({ success: true, message: "User updated", user });
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/users/:id  — admin only
// ─────────────────────────────────────────────────────────────────────────────
const deleteUser = async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw createError(404, "User not found");
  res.json({ success: true, message: "User deleted" });
};

module.exports = { register, login, getMe, getUsers, updateUser, deleteUser };
