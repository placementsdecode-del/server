const ApiError = require("../utils/apiError");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { ensureRole } = require("../services/rbac.service");
const { generateTemporaryPassword } = require("../utils/password");

const listUsers = asyncHandler(async (req, res) => {
  const organization = req.user.roleName === "superadmin" ? req.query.organization : req.user.organization;
  const filter = organization ? { organization } : {};

  const users = await User.find(filter)
    .select("-password")
    .populate("role")
    .populate("organization", "orgName orgEmail")
    .sort({ createdAt: -1 });

  res.json({ users });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, phoneNumber, roleName, password } = req.body;

  if (!name || !email || !roleName) {
    throw new ApiError(400, "name, email, and roleName are required");
  }

  if (!["admin", "teacher", "student"].includes(roleName)) {
    throw new ApiError(400, "Organization users can only be admin, teacher, or student");
  }

  const organizationId = req.user.roleName === "superadmin" ? req.body.organization : req.user.organization;

  if (!organizationId) {
    throw new ApiError(400, "organization is required");
  }

  const role = await ensureRole(roleName, organizationId);
  const generatedPassword = password || generateTemporaryPassword();

  const user = await User.create({
    organization: organizationId,
    name,
    email,
    phoneNumber,
    password: generatedPassword,
    role: role._id,
    roleName,
    createdBy: req.user._id,
    mustChangePassword: !password,
  });

  res.status(201).json({
    message: `${roleName} created`,
    user: {
      id: user._id,
      organization: user.organization,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.roleName,
      mustChangePassword: user.mustChangePassword,
    },
    ...(password ? {} : { temporaryPassword: generatedPassword }),
  });
});

module.exports = { listUsers, createUser };
