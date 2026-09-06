import User from '../../models/User';
import Section from '../../models/Section';
import ApiError from '../../utils/apiError';
export async function managedStudents(user) {
  const filter: Record<string, unknown> = { organization: user.organization, roleName: 'student' };
  if (user.roleName === 'student') filter._id = user._id;
  if (user.roleName === 'teacher') {
    const sections = await Section.find({ organization: user.organization, assignedTeachers: user._id }).select('_id');
    filter.section = { $in: sections.map(section => section._id) };
  }
  return filter;
}
export async function requireStudent(user, id) {
  if (user.roleName === "student" && String(id) !== String(user._id)) throw new ApiError(404, "Student not found");
  const student = await User.findOne({ ...await managedStudents(user), _id: id });
  if (!student) throw new ApiError(404, 'Student not found in your permitted scope');
  await student.populate("section", "name code");
  return student;
}
export const finite = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
