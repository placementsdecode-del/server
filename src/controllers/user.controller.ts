import { managedStudents } from "../services/readiness/access";
import Section from "../models/Section";
import User from "../models/User";
import { ensureRole } from "../services/rbac.service";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";
import { generateTemporaryPassword } from "../utils/password";

const listUsers = asyncHandler(async (req, res) => {
  const organization = req.user.roleName === "superadmin" ? req.query.organization : req.user.organization;
  const filter: Record<string, unknown> = organization ? { organization } : {};
  if (req.user.roleName === "teacher") {
    Object.assign(filter, await managedStudents(req.user));
  }

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

  if (section) await validateStudentSection(section, organizationId, roleName);

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
    cohorts: user.cohorts,
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
    cohorts: user.cohorts,
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

  if (section) await validateStudentSection(section, user.organization, roleName || user.roleName);

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
    cohorts: user.cohorts,
      groups: user.groups,
      preparationScore: user.preparationScore,
      role: user.roleName,
      mustChangePassword: user.mustChangePassword,
      status: user.status,
    },
  });
});

async function validateStudentSection(sectionId, organizationId, roleName) {
  const section = await Section.findById(sectionId);
  if (roleName !== "student" || !section || section.organization.toString() !== organizationId?.toString()) {
    throw new ApiError(400, "Choose a section in the student’s organization");
  }
  if (section.status !== "active") throw new ApiError(400, "Students can only be assigned to active sections");
}

export { listUsers, createUser, updateUser };

export const bulkCreateStudents = asyncHandler(async (req, res) => {
  const rows = req.body.students;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) throw new ApiError(400, 'Upload 1–100 students at a time');
  const results = [];
  const role = await ensureRole('student', req.user.organization);
  for (const [index, row] of rows.entries()) {
    try {
      if (!row || typeof row.name !== 'string' || !row.name.trim() || typeof row.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw new ApiError(400, 'Name and a valid email are required');
      if (!row.section) throw new ApiError(400, 'Select a cohort');
      await validateStudentSection(row.section, req.user.organization, 'student');
      if (req.user.roleName === 'teacher' && !await Section.exists({ _id: row.section, organization: req.user.organization, assignedTeachers: req.user._id })) throw new ApiError(403, 'Choose a cohort you coordinate');
      const password = generateTemporaryPassword(row.email);
      const user = await User.create({ name: row.name.trim(), email: row.email.trim().toLowerCase(), phoneNumber: row.phoneNumber || '', registrationNumber: row.registrationNumber || '', department: row.department || '', batch: row.batch || '', section: row.section, organization: req.user.organization, role: role._id, roleName: 'student', password, mustChangePassword: true, createdBy: req.user._id });
      results.push({ row: index + 1, email: user.email, status: 'created', temporaryPassword: password });
    } catch (error) {
      results.push({ row: index + 1, email: row?.email || '', status: 'failed', error: error.code === 11000 ? 'Email already exists' : error.message });
    }
  }
  res.json({ results });
});
