import Section from "../models/Section";
import User from "../models/User";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";

function organizationFromRequest(req) {
  return req.user.roleName === "superadmin" ? req.query.organization || req.body.organization : req.user.organization;
}

const listSections = asyncHandler(async (req, res) => {
  const organization = organizationFromRequest(req);

  if (!organization) {
    throw new ApiError(400, "organization is required");
  }

  const sections = await Section.find({ organization })
    .populate("assignedTeachers", "name email roleName")
    .sort({ createdAt: -1 });

  res.json({ sections });
});

const createSection = asyncHandler(async (req, res) => {
  const organization = organizationFromRequest(req);
  const { name, code, department, batch, academicYear, assignedTeachers = [], description, status } = req.body;

  if (!organization) {
    throw new ApiError(400, "organization is required");
  }

  if (!name || !code || !department || !batch || !academicYear) {
    throw new ApiError(400, "name, code, department, batch, and academicYear are required");
  }

  const section = await Section.create({
    organization,
    name,
    code,
    department,
    batch,
    academicYear,
    assignedTeachers,
    description,
    status,
  });

  res.status(201).json({ message: "Section created", section });
});

const updateSection = asyncHandler(async (req, res) => {
  const section = await Section.findById(req.params.sectionId);

  if (!section) {
    throw new ApiError(404, "Section not found");
  }

  if (req.user.roleName !== "superadmin" && section.organization.toString() !== req.user.organization.toString()) {
    throw new ApiError(403, "You can only update your own organization sections");
  }

  const allowedFields = ["name", "code", "department", "batch", "academicYear", "assignedTeachers", "description", "status"];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      section[field] = req.body[field];
    }
  }

  await section.save();
  await section.populate("assignedTeachers", "name email roleName");

  res.json({ message: "Section updated", section });
});

const assignStudentToSection = asyncHandler(async (req, res) => {
  const section = await Section.findById(req.params.sectionId);

  if (!section) {
    throw new ApiError(404, "Section not found");
  }

  if (req.user.roleName !== "superadmin" && section.organization.toString() !== req.user.organization.toString()) {
    throw new ApiError(403, "You can only update students in your own organization");
  }

  const student = await User.findById(req.params.studentId);

  if (!student || student.roleName !== "student") {
    throw new ApiError(404, "Student not found");
  }

  if (student.organization?.toString() !== section.organization.toString()) {
    throw new ApiError(400, "Student and section must belong to the same organization");
  }

  student.section = section._id;
  await student.save();

  res.json({ message: "Student assigned to section", student });
});

export { assignStudentToSection, createSection, listSections, updateSection };
