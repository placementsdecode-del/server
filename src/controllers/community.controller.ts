import Section from "../models/Section";
import User from "../models/User";
import Group from "../models/Group";
import Notification from "../models/Notification";
import Assessment from "../models/Assessment";
import AssignedWork from "../models/AssignedWork";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";

export const mySection = asyncHandler(async (req, res) => {
  const section = req.user.section ? await Section.findOne({ _id: req.user.section, organization: req.user.organization }).select("name code department batch academicYear description assignedTeachers").populate("assignedTeachers", "name") : null;
  const classmates = section ? await User.find({ organization: req.user.organization, section: section._id, roleName: "student", status: "active" }).select("name registrationNumber").sort({ name: 1 }) : [];
  res.json({ section, classmates });
});
export const myWork = asyncHandler(async (req, res) => {
  const filter = { organization: req.user.organization, notificationRecipients: req.user._id };
  const [assessments, work] = await Promise.all([
    Assessment.find({ ...filter, status: { $in: ["scheduled", "active", "completed"] } }).select("title instructions category status durationMinutes totalMarks createdAt").lean(),
    AssignedWork.find({ ...filter, status: "published" }).select("title instructions kind status createdAt").lean(),
  ]);
  res.json({ work: [...work, ...assessments.map(item => ({ ...item, kind: "assessment" }))].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)) });
});
export const listNotifications = asyncHandler(async (req, res) => {
  const user = req.user;
  // Reconcile from durable invitation/audience records. A failed request cannot lose a notification.
  // Upserts only set initial values, preserving read and deletion choices on subsequent polls.
  const [groups, assessments, work] = await Promise.all([
    Group.find({ organization: user.organization, "participants.student": user._id }).select("name participants createdAt").lean(),
    Assessment.find({ organization: user.organization, notificationRecipients: user._id, status: { $in: ["scheduled", "active", "completed"] } }).select("title createdAt publishedAt").lean(),
    AssignedWork.find({ organization: user.organization, notificationRecipients: user._id, status: "published" }).select("title kind createdAt publishedAt").lean(),
  ]);
  const events = [
    ...groups.map(group => ({ sourceId: group._id, kind: "invitation" as const, title: `Invitation to ${group.name}`, message: "You have been invited to a group. Accept or decline in the app.", createdAt: group.participants.find(member => member.student.toString() === user._id.toString())?.invitedAt || group.createdAt })),
    ...assessments.map(item => ({ sourceId: item._id, kind: "assessment" as const, title: item.title, message: "An assessment was published for your section.", createdAt: item.publishedAt || item.createdAt })),
    ...work.map(item => ({ sourceId: item._id, kind: "work" as const, title: item.title, message: `A new ${item.kind} was published for your section.`, createdAt: item.publishedAt || item.createdAt })),
  ];
  if (events.length) await Notification.bulkWrite(events.map(event => ({ updateOne: {
    filter: { recipient: user._id, eventKey: `${event.kind}:${event.sourceId}` },
    update: { $setOnInsert: { ...event, recipient: user._id, organization: user.organization, eventKey: `${event.kind}:${event.sourceId}`, read: false, deletedAt: null } }, upsert: true,
  } })), { ordered: false });
  const notifications = await Notification.find({ recipient: user._id, organization: user.organization, deletedAt: null }).sort({ createdAt: -1 }).lean();
  res.json({ notifications: notifications.map(item => ({ ...item, invitationStatus: item.kind === "invitation" ? groups.find(group => group._id.toString() === item.sourceId.toString())?.participants.find(member => member.student.toString() === user._id.toString())?.status : undefined })), unreadCount: notifications.filter(item => !item.read).length });
});
export const updateNotification = asyncHandler(async (req, res) => {
  if (typeof req.body.read !== "boolean") throw new ApiError(400, "read must be true or false");
  const result = await Notification.updateOne({ _id: req.params.notificationId, recipient: req.user._id, deletedAt: null }, { $set: { read: req.body.read } });
  if (!result.matchedCount) throw new ApiError(404, "Notification not found");
  res.json({ message: "Notification updated" });
});
export const deleteNotification = asyncHandler(async (req, res) => {
  const result = await Notification.updateOne({ _id: req.params.notificationId, recipient: req.user._id }, { $set: { deletedAt: new Date() } });
  if (!result.matchedCount) throw new ApiError(404, "Notification not found");
  res.json({ message: "Notification deleted. Any pending invitation is still available in My Groups." });
});
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, deletedAt: null }, { $set: { read: true } });
  res.json({ message: "All notifications marked as read" });
});
