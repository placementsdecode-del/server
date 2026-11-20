import User from "../models/User";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";
import { signToken } from "../utils/token";

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    throw new ApiError(400, "Email and password are required");
  }
  if (Buffer.byteLength(password, 'utf8') > 72) throw new ApiError(400, 'Password must be at most 72 bytes');

  const user: any = await User.findOne({ email: email.trim().toLowerCase() })
    .select("+password")
    .populate("role")
    .populate("organization");

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (user.status !== "active") {
    throw new ApiError(403, "User account is not active");
  }

  if (user.roleName !== 'superadmin' && (!user.organization || user.organization.status !== 'active')) {
    throw new ApiError(403, 'Organization access is suspended or unavailable');
  }

  res.json({
    token: signToken(user),
    user: sanitizeUser(user),
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { phoneNumber, skills, resumeUrl } = req.body;
  if (phoneNumber !== undefined && (typeof phoneNumber !== 'string' || phoneNumber.length > 30)) throw new ApiError(400, 'Phone number must be at most 30 characters');
  if (skills !== undefined && (!Array.isArray(skills) || skills.length > 30 || skills.some(skill => typeof skill !== 'string' || !skill.trim() || skill.length > 60))) throw new ApiError(400, 'Supply up to 30 skills of at most 60 characters');
  if (resumeUrl !== undefined) {
    if (typeof resumeUrl !== 'string' || resumeUrl.length > 2000) throw new ApiError(400, 'Supply a valid resume URL');
    if (resumeUrl.trim()) {
      try { if (!['https:', 'http:'].includes(new URL(resumeUrl).protocol)) throw new Error(); }
      catch { throw new ApiError(400, 'Resume link must use HTTPS or HTTP'); }
    }
  }
  const user = await User.findById(req.user._id).populate('role');
  if (phoneNumber !== undefined) user.phoneNumber = phoneNumber.trim();
  if (skills !== undefined) user.skills = [...new Set<string>(skills.map((skill: string) => skill.trim()))];
  if (resumeUrl !== undefined) user.resumeUrl = resumeUrl.trim();
  await user.save();
  res.json({ message: 'Profile updated', user: sanitizeUser(user) });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }

  if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    throw new ApiError(400, "New password must be at least 8 characters and at most 72 bytes");
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
    registrationNumber: user.registrationNumber,
    department: user.department,
    batch: user.batch,
    skills: user.skills || [],
    resumeUrl: user.resumeUrl || '',
    role: user.roleName,
    permissions: user.role ? user.role.permissions : [],
    organization: user.organization,
    mustChangePassword: user.mustChangePassword,
    status: user.status,
  };
}

export { changePassword, login, me, updateProfile };
