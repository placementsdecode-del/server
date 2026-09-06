import { ReadinessPolicy, ReadinessEvidence, LearningPulse, AcademicRecord, ShortlistDecision, ReadinessConsent } from '../models/Readiness';
import User from '../models/User';
import { policies, dateRange, buildReport } from '../services/readiness/report';
import { skillKey } from '../services/readiness/scoring';
import { finite, managedStudents, requireStudent } from '../services/readiness/access';
import ApiError from '../utils/apiError';
import asyncHandler from '../utils/asyncHandler';

export const listPolicies = asyncHandler(async (req, res) => { res.json({ policies: await policies(req.user.organization) }); });
export const createPolicy = asyncHandler(async (req, res) => {
  const body = req.body;
  if (typeof body.label !== 'string' || !body.label.trim() || body.label.length > 100 || typeof body.key !== 'string' || !/^[a-z0-9-]{1,80}$/.test(body.key)) throw new ApiError(400, 'Provide a role/company label and a lowercase policy key');
  if (!Array.isArray(body.skills) || body.skills.length < 1 || body.skills.length > 30 || !body.skills.some(skill => skill.mandatory)) throw new ApiError(400, 'Define 1–30 skills and at least one mandatory skill');
  const keys = new Set();
  for (const rule of body.skills) {
    if (typeof rule.key !== 'string' || !/^[a-z0-9-]{1,80}$/.test(rule.key) || keys.has(rule.key) || typeof rule.label !== 'string' || !rule.label.trim() || rule.label.length > 100 || !finite(rule.weight, 1, 100) || !finite(rule.minimum, 0, 10) || typeof rule.mandatory !== 'boolean') throw new ApiError(400, 'Each skill needs a unique key, label, weight, threshold out of 10, and mandatory flag');
    keys.add(rule.key);
  }
  for (const [key, min, max] of [['minSamples', 1, 20], ['freshnessDays', 1, 365], ['halfLifeDays', 1, 365], ['readyScore', 1, 10], ['almostScore', 0, 10]] as const) if (!finite(body[key], min, max)) throw new ApiError(400, `Invalid ${key}`);
  if (!Number.isInteger(body.minSamples) || body.almostScore >= body.readyScore) throw new ApiError(400, 'Check sample count and readiness thresholds');
  if (body.minCgpa != null && !finite(body.minCgpa, 0, 10) || body.maxBacklogs != null && (!finite(body.maxBacklogs, 0, 100) || !Number.isInteger(body.maxBacklogs)) || !Array.isArray(body.graduationYears) || body.graduationYears.length > 20 || body.graduationYears.some(year => !Number.isInteger(year) || !finite(year, 2000, 2100))) throw new ApiError(400, 'Invalid academic eligibility criteria');
  const previous = await ReadinessPolicy.findOne({ organization: req.user.organization, key: body.key }).sort({ version: -1 });
  const policy = await ReadinessPolicy.create({ organization: req.user.organization, key: body.key, label: body.label, version: (previous?.version || 0) + 1, skills: body.skills, minSamples: body.minSamples, freshnessDays: body.freshnessDays, halfLifeDays: body.halfLifeDays, readyScore: body.readyScore, almostScore: body.almostScore, minCgpa: body.minCgpa, maxBacklogs: body.maxBacklogs, graduationYears: body.graduationYears, createdBy: req.user._id });
  res.status(201).json({ policy });
});
async function selectedPolicy(req) {
  const available = await policies(req.user.organization);
  const policy = req.query.policy ? available.find(item => String(item._id) === req.query.policy) : available[0];
  if (!policy) throw new ApiError(404, 'Readiness policy not found');
  return policy;
}
export const studentReport = asyncHandler(async (req, res) => {
  const student = await requireStudent(req.user, req.params.studentId || req.user._id);
  res.json(await buildReport(student, await selectedPolicy(req), dateRange(req.query)));
});
export const cohortReport = asyncHandler(async (req, res) => {
  const policy = await selectedPolicy(req); const range = dateRange(req.query);
  const students = await User.find(await managedStudents(req.user)).populate("section", "name code").sort({ name: 1 });
  const reports = [];
  // Bound concurrency to avoid one query per student flooding the database at once.
  for (let index = 0; index < students.length; index += 8) reports.push(...await Promise.all(students.slice(index, index + 8).map(student => buildReport(student, policy, range))));
  res.json({ policy, range, students: reports.map(({ student, overall, status, coverage, eligibility, activity, skills, academics, decisions }) => ({ student, overall, status, coverage, eligibility, activity, skills, academics, decision: decisions[0] || null })) });
});
export const learningPulse = asyncHandler(async (req, res) => {
  const { seconds, context } = req.body;
  if (!finite(seconds, 1, 30) || !Number.isInteger(seconds) || typeof context !== 'string' || context.length > 100) throw new ApiError(400, 'Invalid activity pulse');
  const bucket = Math.floor(Date.now() / 30000);
  await LearningPulse.updateOne({ student: req.user._id, bucket }, { $setOnInsert: { student: req.user._id, organization: req.user.organization, bucket, seconds, context } }, { upsert: true });
  res.json({ message: 'Activity recorded' });
});
export const recordEvidence = asyncHandler(async (req, res) => {
  const student = await requireStudent(req.user, req.user.roleName === 'student' ? req.user._id : req.body.studentId);
  const body = req.body; const selfReported = req.user.roleName === 'student';
  if (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId) || typeof body.reference !== 'string' || !body.reference.trim() || body.reference.length > 200 || typeof body.skill !== 'string' || !skillKey(body.skill) || body.skill.length > 80 || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200 || !['beginner', 'intermediate', 'advanced'].includes(body.difficulty)) throw new ApiError(400, 'Provide a reference, skill, title, difficulty, and request ID');
  if (!selfReported && (!finite(body.maxScore, 1, 10000) || !finite(body.score, 0, body.maxScore) || typeof body.rubric !== 'string' || !body.rubric.trim() || body.rubric.length > 5000)) throw new ApiError(400, 'Instructor evaluations require valid marks and a rubric');
  if (selfReported && (typeof body.solved !== 'boolean' || !Number.isInteger(body.submissions) || !finite(body.submissions, 1, 1000))) throw new ApiError(400, 'Record whether the problem was solved and the number of submissions');
  if (body.testCasesTotal != null && (!Number.isInteger(body.testCasesTotal) || !finite(body.testCasesTotal, 1, 100000) || !Number.isInteger(body.testCasesPassed) || !finite(body.testCasesPassed, 0, body.testCasesTotal))) throw new ApiError(400, 'Invalid test case counts');
  const evidence = await ReadinessEvidence.findOneAndUpdate({ student: student._id, requestId: body.requestId }, { $setOnInsert: { organization: req.user.organization, student: student._id, requestId: body.requestId, reference: body.reference.trim(), skill: skillKey(body.skill), title: body.title.trim(), difficulty: body.difficulty, kind: selfReported ? 'problem' : 'evaluation', source: selfReported ? 'self-reported' : 'instructor-rated', score: selfReported ? null : body.score, maxScore: selfReported ? null : body.maxScore, rubric: selfReported ? '' : body.rubric, feedback: String(body.feedback || '').slice(0, 5000), solved: selfReported ? body.solved : undefined, submissions: selfReported ? body.submissions : undefined, testCasesTotal: selfReported ? body.testCasesTotal : undefined, testCasesPassed: selfReported ? body.testCasesPassed : undefined, createdBy: req.user._id } }, { upsert: true, returnDocument: 'after' });
  res.status(201).json({ evidence });
});
export const recordAcademics = asyncHandler(async (req, res) => {
  const student = await requireStudent(req.user, req.params.studentId); const body = req.body;
  if (!finite(body.cgpa, 0, 10) || !Number.isInteger(body.backlogs) || !finite(body.backlogs, 0, 100) || !Number.isInteger(body.graduationYear) || !finite(body.graduationYear, 2000, 2100) || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 2000) throw new ApiError(400, 'Provide CGPA, backlog count, graduation year and verification reason');
  const record = await AcademicRecord.create({ organization: req.user.organization, student: student._id, cgpa: body.cgpa, backlogs: body.backlogs, graduationYear: body.graduationYear, reason: body.reason, recordedBy: req.user._id });
  res.status(201).json({ record });
});
export const recordDecision = asyncHandler(async (req, res) => {
  const student = await requireStudent(req.user, req.params.studentId);
  if (!['Shortlisted', 'Hold', 'Needs Training', 'Not Eligible'].includes(req.body.decision) || typeof req.body.reason !== 'string' || !req.body.reason.trim() || req.body.reason.length > 2000) throw new ApiError(400, 'Choose a decision and explain the reason');
  const policy = await selectedPolicy(req); const snapshot = await buildReport(student, policy, dateRange(req.query));
  const record = await ShortlistDecision.create({ organization: req.user.organization, student: student._id, policy: policy._id, decision: req.body.decision, reason: req.body.reason, recordedBy: req.user._id, snapshot: { algorithmVersion: snapshot.algorithmVersion, policy, range: snapshot.range, overall: snapshot.overall, status: snapshot.status, eligibility: snapshot.eligibility, evidenceIds: snapshot.evidenceIds, skills: snapshot.skills, academics: snapshot.academics } });
  res.status(201).json({ record });
});
export const consent = asyncHandler(async (req, res) => {
  if (typeof req.body.granted !== 'boolean') throw new ApiError(400, 'Consent must be explicitly granted or revoked');
  await ReadinessConsent.create({ organization: req.user.organization, student: req.user._id, granted: req.body.granted });
  res.json({ message: 'Sharing preference recorded. External HR access is not enabled.' });
});
