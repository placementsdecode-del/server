import User from "../models/User";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";
import { signToken } from "../utils/token";

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user: any = await User.findOne({ email: email.toLowerCase() })
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

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, "New password must be at least 8 characters");
  }

  const user: any = await User.findById(req.user._id).select("+password");

  if (!user || !(await user.comparePassword(currentPassword))) {
    throw new ApiError(401, "Current password is incorrect");
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();

  res.json({ message: "Password changed successfully" });
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

export { changePassword, login, me };
