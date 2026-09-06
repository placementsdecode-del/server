import GroupMessage from "../models/GroupMessage";
import User from "../models/User";
import mongoose from "mongoose";
import Group from "../models/Group";
import { eligibleInvitees } from "../services/audience.service";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";

export const listGroups = asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { organization: req.user.organization };
  if (req.user.roleName === "teacher") filter.$or = [{ createdBy: req.user._id }, { coordinators: req.user._id }];
  if (req.user.roleName === "student") filter.participants = { $elemMatch: { student: req.user._id, status: "accepted" } };
  if (req.user.roleName !== "student") filter.kind = { $ne: "practice" };
  const groups = await Group.find(filter).populate("createdBy", "name").populate("coordinators", "name").populate("participants.student", "name registrationNumber").sort({ createdAt: -1 }).lean();
  const unread = await Promise.all(groups.map(group => GroupMessage.countDocuments({ group: group._id, sender: { $ne: req.user._id }, createdAt: { $gt: group.participants.find(p => String(p.student?._id) === String(req.user._id))?.lastReadAt || new Date(0) } })));
  res.json({ groups: groups.map((group, index) => ({ ...group, unreadCount: unread[index], participants: req.user.roleName === "student" ? group.participants.filter(member => member.status === "accepted") : group.participants })) });
});
export const listInvitations = asyncHandler(async (req, res) => {
  const groups = await Group.find({ organization: req.user.organization, participants: { $elemMatch: { student: req.user._id, status: "pending" } } }).populate("createdBy", "name").select("name description createdBy createdAt").sort({ createdAt: -1 });
  res.json({ invitations: groups });
});
export const createGroup = asyncHandler(async (req, res) => {
  const { name, description = "", students } = req.body;
  if (typeof name !== "string" || !name.trim()) throw new ApiError(400, "Group name is required");
  if (name.trim().length > 120 || typeof description !== "string" || description.length > 2000) throw new ApiError(400, "Use a name up to 120 characters and description up to 2000 characters");
  const practice = req.user.roleName === "student";
  const ids = Array.isArray(students) && students.length === 0 ? [] : await eligibleInvitees(req.user, students);
  if (practice && (typeof req.body.mode !== 'string' || !['Written Test', 'Mock Interview', 'Group Discussion', 'DSA Hackathon'].includes(req.body.mode))) throw new ApiError(400, 'Choose a practice format');
  const group = await Group.create({ name, description, organization: req.user.organization, createdBy: req.user._id, kind: practice ? "practice" : "discussion", mode: practice ? req.body.mode : "Group Discussion", coordinators: practice ? [] : [req.user._id], participants: [...(practice ? [{ student: req.user._id, status: "accepted" }] : []), ...ids.filter(id => String(id) !== String(req.user._id)).map(student => ({ student, status: "pending" }))] });
  res.status(201).json({ group, message: "Group created. Students will receive in-app invitations." });
});
export const inviteStudents = asyncHandler(async (req, res) => {
  const ids = await eligibleInvitees(req.user, req.body.students);
  const filter: Record<string, unknown> = { _id: req.params.groupId, organization: req.user.organization, ...(req.user.roleName === "admin" ? { kind: { $ne: "practice" } } : { createdBy: req.user._id }) };
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

async function accessibleGroup(req) {
  if (!mongoose.isValidObjectId(req.params.groupId)) throw new ApiError(404, 'Group not found');
  const group = await Group.findOne({ _id: req.params.groupId, organization: req.user.organization });
  if (!group) throw new ApiError(404, 'Group not found');
  const member = group.participants.some(p => String(p.student) === String(req.user._id) && p.status === 'accepted');
  const coordinator = group.coordinators.some(id => String(id) === String(req.user._id));
  const owner = String(group.createdBy) === String(req.user._id);
  if (!member && !owner && !(group.kind !== 'practice' && (coordinator || req.user.roleName === 'admin'))) throw new ApiError(403, 'Join this group to access its conversation');
  return group;
}
export const listMessages = asyncHandler(async (req, res) => {
  const group = await accessibleGroup(req);
  const readAt = new Date();
  const messages = await GroupMessage.find({ group: group._id, organization: req.user.organization, createdAt: { $lte: readAt } }).sort({ createdAt: -1 }).limit(100).populate('sender', 'name').lean();
  await Group.updateOne({ _id: group._id, participants: { $elemMatch: { student: req.user._id, status: 'accepted' } } }, { $set: { 'participants.$.lastReadAt': readAt } });
  res.json({ messages: messages.reverse() });
});
export const sendMessage = asyncHandler(async (req, res) => {
  const group = await accessibleGroup(req);
  if (typeof req.body.text !== 'string' || !req.body.text.trim() || req.body.text.length > 5000) throw new ApiError(400, 'Write a message of 1–5000 characters');
  const message = await GroupMessage.create({ group: group._id, organization: req.user.organization, sender: req.user._id, text: req.body.text.trim() });
  res.status(201).json({ message });
});
export const updateCoordinators = asyncHandler(async (req, res) => {
  const group = await accessibleGroup(req);
  if (group.kind === 'practice' || !(req.user.roleName === 'admin' || String(group.createdBy) === String(req.user._id))) throw new ApiError(403, 'Only the group owner or admin can assign coordinators');
  const ids = req.body.coordinators;
  if (!Array.isArray(ids) || ids.length > 50 || ids.some(id => !mongoose.isValidObjectId(id))) throw new ApiError(400, 'Supply valid coordinator IDs');
  const unique = [...new Set(ids)];
  const count = await User.countDocuments({ _id: { $in: unique }, organization: req.user.organization, roleName: { $in: ['teacher', 'admin'] }, status: 'active' });
  if (count !== unique.length) throw new ApiError(400, 'Choose active coordinators in your organization');
  group.coordinators = unique;
  await group.save();
  res.json({ message: 'Coordinators updated' });
});
export const practicePeers = asyncHandler(async (req, res) => {
  const peers = await User.find({ organization: req.user.organization, roleName: 'student', status: 'active', _id: { $ne: req.user._id } }).select('name registrationNumber').sort({ name: 1 }).lean();
  res.json({ peers });
});

export const facultyDirectory = asyncHandler(async (req, res) => {
  const faculty = await User.find({ organization: req.user.organization, roleName: { $in: ['teacher', 'admin'] }, status: 'active' }).select('name roleName').lean();
  res.json({ faculty: faculty.map(u => ({ id: u._id, name: u.name, role: u.roleName })) });
});
