import AssignedWork from "../models/AssignedWork";
import { sectionAudience } from "../services/audience.service";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";
export const listWork = asyncHandler(async (req, res) => {
  const work = await AssignedWork.find({ organization: req.user.organization, ...(req.user.roleName === "teacher" ? { createdBy: req.user._id } : {}) }).populate("assignedSections", "name code").sort({ createdAt: -1 });
  res.json({ work });
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
