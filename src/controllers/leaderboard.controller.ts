import User from '../models/User';
import Section from '../models/Section';
import AssessmentLedger from '../models/AssessmentLedger';
import asyncHandler from '../utils/asyncHandler';
export const leaderboard = asyncHandler(async (req, res) => {
  const [students, sections, ledgers] = await Promise.all([
    User.find({ organization: req.user.organization, roleName: 'student', status: 'active' }).select('name section cohorts').lean(),
    Section.find({ organization: req.user.organization, status: 'active' }).select('name code').lean(),
    AssessmentLedger.find({ organization: req.user.organization, 'attempts.status': 'graded' }).select('student assessment attempts.status attempts.score attempts.totalMarks').lean(),
  ]);
  const scores = new Map<string, number[]>();
  for (const ledger of ledgers) {
    const graded = ledger.attempts.filter(a => a.status === 'graded' && a.totalMarks > 0);
    if (!graded.length) continue;
    const key = String(ledger.student);
    scores.set(key, [...(scores.get(key) || []), Math.max(...graded.map(a => a.score / a.totalMarks * 100))]);
  }
  const rows = students.filter(s => scores.has(String(s._id))).map(s => {
    const values = scores.get(String(s._id))!;
    return { id: s._id, name: s.name, cohortIds: [...new Set([...(s.cohorts || []).map(String), ...(s.section ? [String(s.section)] : [])])], assessments: values.length, score: Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 };
  }).sort((a, b) => b.score - a.score || b.assessments - a.assessments || a.name.localeCompare(b.name));
  res.json({ sections, rows });
});
