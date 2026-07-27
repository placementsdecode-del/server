const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const { signToken } = require("../utils/token");
const User = require("../models/User");

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() })
    .select("+password")
    .populate("role")
    .populate("organization");

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (user.status !== "active") {
    throw new ApiError(403, "User account is not active");
  }

  res.json({
    token: signToken(user),
    user: sanitizeUser(user),
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.roleName,
    permissions: user.role ? user.role.permissions : [],
    organization: user.organization,
    mustChangePassword: user.mustChangePassword,
    status: user.status,
  };
}

module.exports = { login, me };
