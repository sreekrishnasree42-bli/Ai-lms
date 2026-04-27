const jwt = require("jsonwebtoken");

/**
 * Signs and returns a JWT for the given user.
 * @param {Object} user  - Mongoose User document
 * @returns {string}     - Signed JWT string
 */
const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set in environment variables");
  }

  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};

module.exports = generateToken;
