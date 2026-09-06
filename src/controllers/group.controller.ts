import Group from "../models/Group";
import { eligibleInvitees } from "../services/audience.service";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";

export const listGroups = asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { organization: req.user.organization };
  if (req.user.roleName === "teacher") filter.createdBy = req.user._id;
  if (req.user.roleName === "student") filter.participants = { $elemMatch: { student: req.user._id, status: "accepted" } };
  const groups = await Group.find(filter).populate("createdBy", "name").populate("participants.student", "name registrationNumber").sort({ createdAt: -1 }).lean();
  res.json({ groups: groups.map(group => ({ ...group, participants: req.user.roleName === "student" ? group.participants.filter(member => member.status === "accepted") : group.participants })) });
});
export const listInvitations = asyncHandler(async (req, res) => {
  const groups = await Group.find({ organization: req.user.organization, participants: { $elemMatch: { student: req.user._id, status: "pending" } } }).populate("createdBy", "name").select("name description createdBy createdAt").sort({ createdAt: -1 });
  res.json({ invitations: groups });
});
export const createGroup = asyncHandler(async (req, res) => {
  const { name, description = "", students } = req.body;
  if (typeof name !== "string" || !name.trim()) throw new ApiError(400, "Group name is required");
  if (name.trim().length > 120 || typeof description !== "string" || description.length > 2000) throw new ApiError(400, "Use a name up to 120 characters and description up to 2000 characters");
  const ids = await eligibleInvitees(req.user, students);
  const group = await Group.create({ name, description, organization: req.user.organization, createdBy: req.user._id, participants: ids.map(student => ({ student, status: "pending" })) });
  res.status(201).json({ group, message: "Group created. Students will receive in-app invitations." });
});
export const inviteStudents = asyncHandler(async (req, res) => {
  const ids = await eligibleInvitees(req.user, req.body.students);
  const filter = { _id: req.params.groupId, organization: req.user.organization, ...(req.user.roleName === "teacher" ? { createdBy: req.user._id } : {}) };
  if (!await Group.exists(filter)) throw new ApiError(404, "Group not found");
  // One conditional update per student prevents duplicate invitations under concurrent requests.
  for (const student of ids) {
    await Group.updateOne({ ...filter, "participants.student": { $ne: student } }, { $push: { participants: { student, status: "pending" } } });
  }
  res.json({ message: "Invitations sent. Existing invitations and memberships were kept." });
});
export const respondToInvitation = asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!["accepted", "declined"].includes(status)) throw new ApiError(400, "Choose accepted or declined");
  const group = await Group.findOneAndUpdate({ _id: req.params.groupId, organization: req.user.organization, participants: { $elemMatch: { student: req.user._id, status: "pending" } } }, { $set: { "participants.$.status": status, "participants.$.respondedAt": new Date() } }, { returnDocument: "after" });
  if (!group) throw new ApiError(409, "This invitation is no longer pending. Refresh your invitations.");
  res.json({ message: status === "accepted" ? "You joined the group." : "Invitation declined." });
});
