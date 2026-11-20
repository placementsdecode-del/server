import Section from "../models/Section";
import Group from "../models/Group";
import User from "../models/User";
import { assessmentAudience } from "../services/audience.service";
import Assessment from "../models/Assessment";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";

function organizationFromRequest(req) {
  return req.user.roleName === "superadmin" ? req.query.organization || req.body.organization : req.user.organization;
}

const assessmentFields = ["title", "description", "category", "difficulty", "instructions", "rubric", "durationMinutes", "totalMarks", "passingMarks", "attemptsAllowed", "negativeMarking", "shuffleQuestions", "shuffleOptions", "showResultImmediately", "allowAnswerReview", "assignedSections", "assignedGroups", "assignedTeachers", "questions", "status"];

export function validateAssessmentPayload(payload) {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object') return ['Assessment details are required'];
  for (const field of ['title', 'category', 'instructions']) {
    if (typeof payload[field] !== 'string' || !payload[field].trim()) errors.push(`${field} is required`);
  }
  if (!Number.isInteger(Number(payload.durationMinutes)) || Number(payload.durationMinutes) < 1 || Number(payload.durationMinutes) > 600) errors.push('Duration must be between 1 and 600 minutes');
  if (!Number.isFinite(Number(payload.totalMarks)) || Number(payload.totalMarks) < 1) errors.push('Total marks must be positive and finite');
  if (payload.passingMarks === undefined || !Number.isFinite(Number(payload.passingMarks)) || Number(payload.passingMarks) < 0 || Number(payload.passingMarks) > Number(payload.totalMarks)) errors.push('Passing marks must be between zero and total marks');
  if (payload.attemptsAllowed !== undefined && (!Number.isInteger(payload.attemptsAllowed) || payload.attemptsAllowed < 1 || payload.attemptsAllowed > 20)) errors.push('Attempts must be between 1 and 20');
  for (const field of ['assignedSections', 'assignedGroups', 'assignedTeachers']) {
    if (payload[field] !== undefined && !Array.isArray(payload[field])) errors.push(`${field} must be an array`);
  }
  for (const field of ['negativeMarking', 'shuffleQuestions', 'shuffleOptions', 'showResultImmediately', 'allowAnswerReview']) {
    if (payload[field] !== undefined && typeof payload[field] !== 'boolean') errors.push(`${field} must be a boolean`);
  }
  if (!Array.isArray(payload.questions) || !payload.questions.length || payload.questions.length > 100) return [...errors, 'Supply between 1 and 100 questions'];
  let questionMarks = 0;
  const types = ['single-choice', 'multiple-choice', 'true-false', 'short-answer', 'long-answer', 'coding', 'file-upload', 'numerical'];
  payload.questions.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    if (!question || typeof question !== 'object') { errors.push(`${label} is invalid`); return; }
    if (!types.includes(question.type)) errors.push(`${label} needs a supported question type`);
    if (typeof question.text !== 'string' || !question.text.trim()) errors.push(`${label} needs question text`);
    const marks = Number(question.marks);
    if (!Number.isFinite(marks) || marks < 1) errors.push(`${label} needs positive finite marks`);
    else questionMarks += marks;
    if (question.negativeMarks !== undefined && (!Number.isFinite(Number(question.negativeMarks)) || Number(question.negativeMarks) < 0 || Number(question.negativeMarks) > marks)) errors.push(`${label} has invalid negative marks`);
    if (['single-choice', 'multiple-choice'].includes(question.type)) {
      const options = question.options;
      if (!Array.isArray(options) || options.length < 2 || options.some(option => typeof option !== 'string' || !option.trim()) || new Set(options).size !== options.length) {
        errors.push(`${label} needs distinct nonempty options`);
      }
      if (question.type === 'single-choice' && (!Array.isArray(options) || !options.includes(question.correctAnswer))) errors.push(`${label} needs a correct answer from its options`);
      if (question.type === 'multiple-choice' && (!Array.isArray(options) || !Array.isArray(question.correctAnswer) || !question.correctAnswer.length || question.correctAnswer.some(answer => !options.includes(answer)))) errors.push(`${label} needs valid correct options`);
    }
    if (question.type === 'numerical' && (question.correctAnswer === null || question.correctAnswer === undefined || String(question.correctAnswer).trim() === '' || !Number.isFinite(Number(question.correctAnswer)))) errors.push(`${label} needs a numeric answer`);
    if (question.type === 'true-false' && !['true', 'false', true, false].includes(question.correctAnswer)) errors.push(`${label} needs a true/false answer`);
  });
  if (Math.abs(questionMarks - Number(payload.totalMarks)) > 0.000001) errors.push('Question marks must add up to total marks');
  return errors;
}

const listAssessments = asyncHandler(async (req, res) => {
  const organization = organizationFromRequest(req);

  if (!organization) {
    throw new ApiError(400, "organization is required");
  }

  const sections = req.user.roleName === 'teacher' ? await Section.find({ organization, assignedTeachers: req.user._id }).select('_id') : [];
  const groups = req.user.roleName === 'teacher' ? await Group.find({ organization, $or: [{ createdBy: req.user._id }, { coordinators: req.user._id }], kind: { $ne: 'practice' } }).select('_id') : [];
  const assessments = await Assessment.find({ organization, ...(req.user.roleName === "teacher" ? { $or: [{ createdBy: req.user._id }, { assignedTeachers: req.user._id }, { assignedSections: { $in: sections.map(s => s._id) } }, { assignedGroups: { $in: groups.map(g => g._id) } }] } : {}) })
    .populate("assignedGroups", "name")
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

  const audience = await assessmentAudience(req.user, organization, req.body.assignedSections || [], req.body.assignedGroups || []);
  const assignedTeachers = req.body.assignedTeachers || [];
  if (assignedTeachers.length && await User.countDocuments({ _id: { $in: assignedTeachers }, organization, roleName: { $in: ['admin', 'teacher'] }, status: 'active' }) !== new Set(assignedTeachers.map(String)).size) {
    throw new ApiError(400, 'Choose active faculty in this organization');
  }
  if (["active", "scheduled"].includes(req.body.status) && !req.body.assignedSections?.length && !req.body.assignedGroups?.length) throw new ApiError(400, "Assign a cohort or group before publishing");
  const assessment = await Assessment.create({
    ...Object.fromEntries(assessmentFields.filter(field => req.body[field] !== undefined).map(field => [field, req.body[field]])),
    organization,
    createdBy: req.user._id,
    publishedAt: ["active", "scheduled"].includes(req.body.status) ? new Date() : null,
    notificationRecipients: ["active", "scheduled"].includes(req.body.status) ? audience.map(user => user._id) : [],
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

  if (req.user.roleName === "teacher" && assessment.createdBy.toString() !== req.user._id.toString()) throw new ApiError(403, "You can only update assessments you created");
  const wasPublished = !!assessment.publishedAt || assessment.notificationRecipients.length > 0 || ["active", "scheduled", "completed"].includes(assessment.status);
  if (wasPublished && ["questions", "category", "difficulty", "totalMarks", "durationMinutes", "negativeMarking", "passingMarks", "shuffleQuestions", "shuffleOptions", "showResultImmediately", "allowAnswerReview"].some(field => req.body[field] !== undefined)) throw new ApiError(400, "Published assessment content is immutable. Create a new assessment for different questions or rules.");
  if (wasPublished && (req.body.assignedSections || req.body.assignedGroups)) throw new ApiError(400, "Published assessment audiences cannot be changed");
  const fields = ["title", "description", "category", "difficulty", "instructions", "rubric", "durationMinutes", "totalMarks", "passingMarks", "attemptsAllowed", "negativeMarking", "shuffleQuestions", "shuffleOptions", "showResultImmediately", "allowAnswerReview", "assignedSections", "assignedGroups", "questions", "status"];
  for (const field of fields) if (req.body[field] !== undefined) assessment[field] = req.body[field];
  if (!wasPublished && ["active", "scheduled"].includes(assessment.status)) {
    if (!assessment.assignedSections.length && !assessment.assignedGroups.length) throw new ApiError(400, 'Select a cohort or group before publishing');
    const audience = await assessmentAudience(req.user, assessment.organization, assessment.assignedSections, assessment.assignedGroups);
    assessment.notificationRecipients = audience.map(user => user._id);
    assessment.publishedAt = new Date();
  }

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
  if (req.params.assessmentId && !assessment) throw new ApiError(404, 'Assessment not found');
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
