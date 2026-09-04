import Assessment from "../models/Assessment";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";

function organizationFromRequest(req) {
  return req.user.roleName === "superadmin" ? req.query.organization || req.body.organization : req.user.organization;
}

function validateAssessmentPayload(payload) {
  const errors: string[] = [];

  if (!payload.title?.trim()) errors.push("Assessment title is required");
  if (!payload.category?.trim()) errors.push("Category is required");
  if (!payload.instructions?.trim()) errors.push("Instructions are required");
  if (!Number(payload.durationMinutes) || Number(payload.durationMinutes) < 1) errors.push("Duration must be at least 1 minute");
  if (!Number(payload.totalMarks) || Number(payload.totalMarks) < 1) errors.push("Total marks must be greater than 0");
  if (Number(payload.passingMarks) < 0) errors.push("Passing marks cannot be negative");
  if (Number(payload.passingMarks) > Number(payload.totalMarks)) errors.push("Passing marks cannot exceed total marks");
  if (!Array.isArray(payload.questions) || payload.questions.length === 0) errors.push("At least one question is required");

  const questionMarks = Array.isArray(payload.questions)
    ? payload.questions.reduce((total, question) => total + Number(question.marks || 0), 0)
    : 0;

  if (questionMarks !== Number(payload.totalMarks)) {
    errors.push("Question marks must add up to total marks");
  }

  payload.questions?.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    if (!question.text?.trim()) errors.push(`${label}: text is required`);
    if (!Number(question.marks) || Number(question.marks) < 1) errors.push(`${label}: marks must be greater than 0`);
    if (["single-choice", "multiple-choice"].includes(question.type)) {
      if (!Array.isArray(question.options) || question.options.length < 2) errors.push(`${label}: at least two options are required`);
      if (!question.correctAnswer || (Array.isArray(question.correctAnswer) && question.correctAnswer.length === 0)) {
        errors.push(`${label}: correct answer is required`);
      }
    }
    if (question.type === "true-false" && !["true", "false", true, false].includes(question.correctAnswer)) {
      errors.push(`${label}: true/false correct answer is required`);
    }
  });

  return errors;
}

const listAssessments = asyncHandler(async (req, res) => {
  const organization = organizationFromRequest(req);

  if (!organization) {
    throw new ApiError(400, "organization is required");
  }

  const assessments = await Assessment.find({ organization })
    .populate("assignedSections", "name code")
    .populate("assignedTeachers", "name email roleName")
    .sort({ createdAt: -1 });

  res.json({ assessments });
});

const createAssessment = asyncHandler(async (req, res) => {
  const organization = organizationFromRequest(req);

  if (!organization) {
    throw new ApiError(400, "organization is required");
  }

  const validationErrors = validateAssessmentPayload(req.body);

  if (validationErrors.length) {
    throw new ApiError(400, validationErrors.join("; "));
  }

  const assessment = await Assessment.create({
    ...req.body,
    organization,
    createdBy: req.user._id,
  });

  res.status(201).json({ message: "Assessment created", assessment });
});

const updateAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.assessmentId);

  if (!assessment) {
    throw new ApiError(404, "Assessment not found");
  }

  if (req.user.roleName !== "superadmin" && assessment.organization.toString() !== req.user.organization.toString()) {
    throw new ApiError(403, "You can only update your own organization assessments");
  }

  Object.assign(assessment, req.body);

  const validationErrors = validateAssessmentPayload(assessment.toObject());

  if (validationErrors.length) {
    throw new ApiError(400, validationErrors.join("; "));
  }

  await assessment.save();
  res.json({ message: "Assessment updated", assessment });
});

const validateAssessment = asyncHandler(async (req, res) => {
  const assessment = req.params.assessmentId
    ? await Assessment.findById(req.params.assessmentId)
    : null;
  const payload = assessment ? assessment.toObject() : req.body;

  if (!payload) {
    throw new ApiError(404, "Assessment not found");
  }

  if (assessment && req.user.roleName !== "superadmin" && assessment.organization.toString() !== req.user.organization.toString()) {
    throw new ApiError(403, "You can only validate your own organization assessments");
  }

  const errors = validateAssessmentPayload(payload);
  res.json({ valid: errors.length === 0, errors });
});

export { createAssessment, listAssessments, updateAssessment, validateAssessment };
