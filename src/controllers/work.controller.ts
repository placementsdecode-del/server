import AssignedWork from "../models/AssignedWork";
import { sectionAudience } from "../services/audience.service";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";
import WorkSubmission from '../models/WorkSubmission';
import { managedStudents } from '../services/readiness/access';
import User from '../models/User';
export const listWork = asyncHandler(async (req, res) => {
  const work = await AssignedWork.find({ organization: req.user.organization, ...(req.user.roleName === "teacher" ? { createdBy: req.user._id } : {}) }).populate("assignedSections", "name code").sort({ createdAt: -1 });
  res.json({ work });
});

export const submitWork = asyncHandler(async (req, res) => {
  const work = await AssignedWork.findOne({ _id: req.params.workId, organization: req.user.organization, notificationRecipients: req.user._id, status: 'published', kind: { $ne: 'announcement' } });
  if (!work) throw new ApiError(404, 'Assigned work not found');
  if (typeof req.body.response !== 'string' || !req.body.response.trim() || req.body.response.length > 10000) throw new ApiError(400, 'Supply a response of up to 10,000 characters');
  const filter = { organization: req.user.organization, work: work._id, student: req.user._id };
  if (await WorkSubmission.exists({ ...filter, status: 'reviewed' })) throw new ApiError(409, 'This work has already been reviewed');
  const submission = await WorkSubmission.findOneAndUpdate({ ...filter, status: { $ne: 'reviewed' } }, {
    $set: { response: req.body.response.trim() }, $setOnInsert: { ...filter, status: 'submitted' },
  }, { upsert: true, returnDocument: 'after', runValidators: true });
  res.json({ submission, message: 'Response submitted' });
});

export const listWorkSubmissions = asyncHandler(async (req, res) => {
  const work = await AssignedWork.findOne({ _id: req.params.workId, organization: req.user.organization,
    ...(req.user.roleName === 'teacher' ? { createdBy: req.user._id } : {}) });
  if (!work) throw new ApiError(404, 'Work not found');
  const students = await User.find({ ...await managedStudents(req.user), _id: { $in: work.notificationRecipients } }).select('_id');
  const submissions = await WorkSubmission.find({ organization: req.user.organization, work: work._id, student: { $in: students.map(student => student._id) } }).populate('student', 'name registrationNumber').sort({ createdAt: -1 }).lean();
  res.json({ submissions });
});

export const reviewWork = asyncHandler(async (req, res) => {
  if (typeof req.body.feedback !== 'string' || !req.body.feedback.trim() || req.body.feedback.length > 5000) throw new ApiError(400, 'Supply feedback of up to 5,000 characters');
  const work = await AssignedWork.findOne({ _id: req.params.workId, organization: req.user.organization,
    ...(req.user.roleName === 'teacher' ? { createdBy: req.user._id } : {}) });
  if (!work) throw new ApiError(404, 'Work not found');
  const students = await User.find(await managedStudents(req.user)).select('_id');
  const submission = await WorkSubmission.findOneAndUpdate({ _id: req.params.submissionId, work: work._id, organization: req.user.organization,
    student: { $in: students.map(student => student._id) }, status: 'submitted' }, {
    $set: { status: 'reviewed', feedback: req.body.feedback.trim(), reviewedAt: new Date(), reviewedBy: req.user._id },
  }, { returnDocument: 'after' });
  if (!submission) throw new ApiError(409, 'Submission is unavailable or already reviewed');
  res.json({ message: 'Feedback recorded' });
});
export const createWork = asyncHandler(async (req, res) => {
  const { title, instructions, kind, assignedSections, status = "draft" } = req.body;
  if (typeof title !== "string" || !title.trim() || typeof instructions !== "string" || !instructions.trim()) throw new ApiError(400, "Title and instructions are required");
  if (title.trim().length > 200 || instructions.trim().length > 10000) throw new ApiError(400, "Title or instructions are too long");
  if (!["task", "homework", "activity", "announcement"].includes(kind)) throw new ApiError(400, "Choose a supported work type");
  if (!["draft", "published"].includes(status)) throw new ApiError(400, "Invalid publish state");
  const audience = await sectionAudience(req.user, req.user.organization, assignedSections || []);
  const work = await AssignedWork.create({ title, instructions, kind, assignedSections, status, organization: req.user.organization, createdBy: req.user._id, publishedAt: status === "published" ? new Date() : null, notificationRecipients: status === "published" ? audience.map(user => user._id) : [] });
  res.status(201).json({ work, message: status === "published" ? "Published and available in students’ notifications." : "Draft saved." });
});
export const publishWork = asyncHandler(async (req, res) => {
  const work = await AssignedWork.findOne({ _id: req.params.workId, organization: req.user.organization, ...(req.user.roleName === "teacher" ? { createdBy: req.user._id } : {}) });
  if (!work) throw new ApiError(404, "Work not found");
  if (work.status !== "published") {
    const audience = await sectionAudience(req.user, work.organization, work.assignedSections);
    await AssignedWork.updateOne({ _id: work._id, status: "draft" }, { $set: { status: "published", publishedAt: new Date(), notificationRecipients: audience.map(user => user._id) } });
  }
  res.json({ message: "Work published." });
});
