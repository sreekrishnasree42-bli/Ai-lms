const jwt  = require("jsonwebtoken");
const User = require("../models/User");

/**
 * protect
 * -------
 * Verifies the Bearer JWT from the Authorization header.
 * On success, attaches the full user document to req.user.
 *
 * Frontend sends:
 *   headers: { Authorization: localStorage.getItem("token") }
 * Note: the frontend stores the raw token (not "Bearer <token>"),
 *   so we accept both formats.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.token || "";

    // Accept  "Bearer <token>"  OR  just  "<token>"
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;

    if (!token) {
      return res.status(401).json({ message: "Unauthorised: no token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Unauthorised: user not found" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "Account has been deactivated" });
    }

    req.user = user;
    next();
  } catch (err) {
    const msg =
      err.name === "TokenExpiredError"
        ? "Token expired — please log in again"
        : "Invalid token";
    return res.status(401).json({ message: msg });
  }
};

/**
 * authorize(...roles)
 * -------------------
 * Role-based access control middleware factory.
 * Usage:  router.delete("/:id", protect, authorize("admin"), handler)
 */
const authorize = (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorised" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: requires ${roles.join(" or ")} role`,
      });
    }
    next();
  };

module.exports = { protect, authorize };
