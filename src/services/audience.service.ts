import mongoose from "mongoose";
import Section from "../models/Section";
import User from "../models/User";
import ApiError from "../utils/apiError";

export function requireIds(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 500 || value.some(id => typeof id !== "string" || !mongoose.isValidObjectId(id))) {
    throw new ApiError(400, `${label} must contain between 1 and 500 valid IDs`);
  }
  return [...new Set(value)] as string[];
}
export async function sectionAudience(user, organization, ids) {
  const sectionIds = requireIds(Array.isArray(ids) ? ids.map(id => id?.toString()) : ids, "Sections");
  const sections = await Section.find({ _id: { $in: sectionIds }, organization, status: "active", ...(user.roleName === "teacher" ? { assignedTeachers: user._id } : {}) }).select("_id");
  if (sections.length !== sectionIds.length) throw new ApiError(403, "Choose active sections that you manage in this organization");
  return User.find({ organization, section: { $in: sectionIds }, roleName: "student", status: "active" }).select("_id");
}
export async function eligibleInvitees(user, ids) {
  const studentIds = requireIds(ids, "Students");
  const filter: Record<string, unknown> = { _id: { $in: studentIds }, organization: user.organization, roleName: "student", status: "active" };
  if (user.roleName === "teacher") {
    const sections = await Section.find({ organization: user.organization, assignedTeachers: user._id }).select("_id");
    filter.section = { $in: sections.map(section => section._id) };
  }
  const students = await User.find(filter).select("_id");
  if (students.length !== studentIds.length) throw new ApiError(403, "Only invite active students you manage in your organization");
  return studentIds;
}
