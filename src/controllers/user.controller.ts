import User from "../models/User";
import { ensureRole } from "../services/rbac.service";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";
import { generateTemporaryPassword } from "../utils/password";

const listUsers = asyncHandler(async (req, res) => {
  const organization = req.user.roleName === "superadmin" ? req.query.organization : req.user.organization;
  const filter = organization ? { organization } : {};

  const users = await User.find(filter)
    .select("-password")
    .populate("role")
    .populate("organization", "orgName orgEmail")
    .sort({ createdAt: -1 });

  res.json({ users: users.map(sanitizeUser) });
});

const createUser = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phoneNumber,
    roleName,
    password,
    registrationNumber,
    department,
    batch,
    section,
    groups,
    preparationScore,
  } = req.body;

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
  const generatedPassword = password || generateTemporaryPassword(email);

  const user = await User.create({
    organization: organizationId,
    name,
    email,
    phoneNumber,
    registrationNumber,
    department,
    batch,
    section,
    groups,
    preparationScore,
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
      registrationNumber: user.registrationNumber,
      department: user.department,
      batch: user.batch,
      section: user.section,
      groups: user.groups,
      preparationScore: user.preparationScore,
      role: user.roleName,
      mustChangePassword: user.mustChangePassword,
    },
    ...(password ? {} : { temporaryPassword: generatedPassword }),
  });
});

function sanitizeUser(user) {
  return {
    id: user._id,
    _id: user._id,
    organization: user.organization,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    registrationNumber: user.registrationNumber,
    department: user.department,
    batch: user.batch,
    section: user.section,
    groups: user.groups,
    preparationScore: user.preparationScore,
    role: user.roleName,
    permissions: user.role ? user.role.permissions : [],
    mustChangePassword: user.mustChangePassword,
    status: user.status,
  };
}

const updateUser = asyncHandler(async (req, res) => {
  const { name, email, phoneNumber, roleName, status, password, registrationNumber, department, batch, section, groups, preparationScore } = req.body;
  const user = await User.findById(req.params.userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (req.user.roleName !== "superadmin" && user.organization?.toString() !== req.user.organization.toString()) {
    throw new ApiError(403, "You can only update users in your own organization");
  }

  if (roleName !== undefined) {
    if (!["admin", "teacher", "student"].includes(roleName)) {
      throw new ApiError(400, "Organization users can only be admin, teacher, or student");
    }

    if (!user.organization) {
      throw new ApiError(400, "Cannot assign organization roles to a platform user");
    }

    const role = await ensureRole(roleName, user.organization);
    user.role = role._id;
    user.roleName = roleName;
  }

  if (status !== undefined) {
    if (!["active", "inactive"].includes(status)) {
      throw new ApiError(400, "status must be active or inactive");
    }
    user.status = status;
  }

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
  if (registrationNumber !== undefined) user.registrationNumber = registrationNumber;
  if (department !== undefined) user.department = department;
  if (batch !== undefined) user.batch = batch;
  if (section !== undefined) user.section = section;
  if (groups !== undefined) user.groups = groups;
  if (preparationScore !== undefined) user.preparationScore = preparationScore;
  if (password) {
    user.password = password;
    user.mustChangePassword = false;
  }

  await user.save();

  res.json({
    message: "User updated",
    user: {
      id: user._id,
      organization: user.organization,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      registrationNumber: user.registrationNumber,
      department: user.department,
      batch: user.batch,
      section: user.section,
      groups: user.groups,
      preparationScore: user.preparationScore,
      role: user.roleName,
      mustChangePassword: user.mustChangePassword,
      status: user.status,
    },
  });
});

export { listUsers, createUser, updateUser };
