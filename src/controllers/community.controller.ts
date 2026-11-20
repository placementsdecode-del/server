import mongoose from "mongoose";
import Section from "../models/Section";
import User from "../models/User";
import Group from "../models/Group";
import Notification from "../models/Notification";
import Assessment from "../models/Assessment";
import AssignedWork from "../models/AssignedWork";
import WorkSubmission from '../models/WorkSubmission';
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";

export const mySection = asyncHandler(async (req, res) => {
  const ids = [...(req.user.cohorts || []), ...(req.user.section ? [req.user.section] : [])];
  const cohorts = await Section.find({ _id: { $in: ids }, organization: req.user.organization }).select('name code department batch academicYear description assignedTeachers').populate('assignedTeachers', 'name').lean();
  if (req.query.view === 'summary') return res.json({ sections: cohorts, section: cohorts[0] || null, classmates: [] });
  const sections = await Promise.all(cohorts.map(async section => ({ ...section, classmates: await User.find({ organization: req.user.organization, $or: [{ section: section._id }, { cohorts: section._id }], roleName: 'student', status: 'active' }).select('name registrationNumber').sort({ name: 1 }).lean() })));
  res.json({ sections, section: sections[0] || null, classmates: sections[0]?.classmates || [] });
});
export const myWork = asyncHandler(async (req, res) => {
  const filter = { organization: req.user.organization, notificationRecipients: req.user._id };
  const [assessments, work] = await Promise.all([
    Assessment.find({ ...filter, status: { $in: ["scheduled", "active", "completed"] } }).select("title instructions category status durationMinutes totalMarks createdAt").lean(),
    AssignedWork.find({ ...filter, status: "published" }).select("title instructions kind status createdAt").lean(),
  ]);
  const submissions = await WorkSubmission.find({ organization: req.user.organization, student: req.user._id, work: { $in: work.map(item => item._id) } }).select('work response status feedback updatedAt').lean();
  const byWork = new Map(submissions.map(submission => [String(submission.work), submission]));
  res.json({ work: [...work.map(item => ({ ...item, submission: byWork.get(String(item._id)) || null })), ...assessments.map(item => ({ ...item, kind: "assessment" }))].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)) });
});
export const listNotifications = asyncHandler(async (req, res) => {
  const user = req.user;
  const { before, limit } = req.query;
  const pageSize = limit === undefined ? undefined : Number(limit);
  if (pageSize !== undefined && (typeof limit !== 'string' || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50)) {
    throw new ApiError(400, 'Choose a notification page size between 1 and 50');
  }
  let cursor: { createdAt: Date; id: string } | undefined;
  if (before !== undefined) {
    const [timestamp, id, extra] = typeof before === 'string' ? before.split('/') : [];
    const createdAt = new Date(timestamp);
    if (!pageSize || extra !== undefined || !Number.isFinite(+createdAt) || !mongoose.isValidObjectId(id)) {
      throw new ApiError(400, 'Invalid notification cursor');
    }
    cursor = { createdAt, id };
  }
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
  const owner = { recipient: user._id, organization: user.organization };
  if (events.length) {
    const candidates = events.map(event => ({ ...event, eventKey: `${event.kind}:${event.sourceId}` }));
    const known = new Set(await Notification.distinct('eventKey', { ...owner, eventKey: { $in: candidates.map(event => event.eventKey) } }));
    const missing = candidates.filter(event => !known.has(event.eventKey));
    if (missing.length) await Notification.bulkWrite(missing.map(event => ({ updateOne: {
      filter: { recipient: user._id, eventKey: event.eventKey },
      update: { $setOnInsert: { ...event, ...owner, read: false, deletedAt: null, updatedAt: event.createdAt } },
      upsert: true,
      timestamps: false,
    } })), { ordered: false });
  }
  const visible = { ...owner, deletedAt: null };
  const query = Notification.find({ ...visible, ...(cursor ? { $or: [
    { createdAt: { $lt: cursor.createdAt } },
    { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
  ] } : {}) }).sort({ createdAt: -1, _id: -1 });
  if (pageSize) query.limit(pageSize + 1);
  const [rows, unreadCount] = await Promise.all([
    query.lean(),
    pageSize ? Notification.countDocuments({ ...visible, read: false }) : Promise.resolve(undefined),
  ]);
  const notifications = pageSize ? rows.slice(0, pageSize) : rows;
  const last = notifications.at(-1);
  const nextCursor = last && rows.length > notifications.length ? `${last.createdAt.toISOString()}/${last._id}` : null;
  const invitations = new Map(groups.map(group => [String(group._id), group.participants.find(member => String(member.student) === String(user._id))?.status]));
  res.json({
    notifications: notifications.map(item => ({ ...item, invitationStatus: item.kind === 'invitation' ? invitations.get(String(item.sourceId)) : undefined })),
    unreadCount: unreadCount ?? notifications.filter(item => !item.read).length,
    ...(pageSize ? { nextCursor } : {}),
  });
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
