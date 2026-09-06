import mongoose from 'mongoose';
import Assessment from '../models/Assessment';
import AssessmentLedger from '../models/AssessmentLedger';
import { requireStudent, finite, managedStudents } from '../services/readiness/access';
import { skillKey } from '../services/readiness/scoring';
import { autoMarks, automaticTypes, validateAnswers } from '../services/readiness/grading';
import User from '../models/User';
import ApiError from '../utils/apiError';
import asyncHandler from '../utils/asyncHandler';
function publicAttempt(attempt, ledgerId, number) {
  return { id: attempt._id, ledgerId, attemptNumber: number, title: attempt.title, skill: attempt.skill, difficulty: attempt.difficulty, status: attempt.status, startedAt: attempt.startedAt, dueAt: attempt.dueAt, submittedAt: attempt.submittedAt, gradedAt: attempt.gradedAt, totalMarks: attempt.totalMarks, score: attempt.status === 'graded' ? attempt.score : null, feedback: attempt.feedback, rubric: attempt.rubric, answers: attempt.answers,
    questions: attempt.questions.map(question => ({ id: question._id, type: question.type, text: question.text, options: question.options, marks: question.marks })),
  };
}
export const assessmentCatalog = asyncHandler(async (req, res) => {
  const [assessments, ledgers] = await Promise.all([
    Assessment.find({ organization: req.user.organization, notificationRecipients: req.user._id, status: { $in: ['active', 'scheduled', 'completed'] } }).select('title category difficulty instructions status durationMinutes attemptsAllowed totalMarks').lean(),
    AssessmentLedger.find({ student: req.user._id, organization: req.user.organization }).lean(),
  ]);
  res.json({ assessments: assessments.map(assessment => ({ ...assessment, attempts: (ledgers.find(ledger => String(ledger.assessment) === String(assessment._id))?.attempts || []).map(attempt => ({ id: attempt._id, status: attempt.status, score: attempt.status === 'graded' ? attempt.score : null, totalMarks: attempt.totalMarks, startedAt: attempt.startedAt })) })),
    attempts: ledgers.flatMap(ledger => ledger.attempts.map((attempt, index) => publicAttempt(attempt, ledger._id, index + 1))),
  });
});
export const startAttempt = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findOne({ _id: req.params.assessmentId, organization: req.user.organization, notificationRecipients: req.user._id, status: 'active' });
  if (!assessment) throw new ApiError(404, 'An active assigned assessment is required');
  if (!assessment.questions.length || assessment.questions.length > 100 || !finite(assessment.durationMinutes, 1, 600) || !Number.isInteger(assessment.attemptsAllowed) || !finite(assessment.attemptsAllowed, 1, 20)) throw new ApiError(400, 'This assessment needs valid questions, duration and attempt limits');
  const filter = { student: req.user._id, assessment: assessment._id, organization: req.user.organization };
  await AssessmentLedger.updateOne(filter, { $setOnInsert: { ...filter, attempts: [] } }, { upsert: true });
  let ledger = await AssessmentLedger.findOne(filter);
  let active = ledger.attempts.find(attempt => attempt.status === 'in-progress');
  if (!active) {
    const now = new Date();
    const attempt = { _id: new mongoose.Types.ObjectId(), startedAt: now, dueAt: new Date(+now + assessment.durationMinutes * 60000), status: 'in-progress', title: assessment.title, skill: skillKey(assessment.category), difficulty: assessment.difficulty, totalMarks: assessment.totalMarks, negativeMarking: assessment.negativeMarking, questions: assessment.questions.toObject(), answers: [], marks: [] };
    // Attempt allowance and absence of another active attempt are checked in a single atomic update.
    await AssessmentLedger.updateOne({ ...filter, 'attempts.status': { $ne: 'in-progress' }, $expr: { $lt: [{ $size: '$attempts' }, assessment.attemptsAllowed] } }, { $push: { attempts: attempt } });
    ledger = await AssessmentLedger.findOne(filter);
    active = ledger.attempts.find(item => item.status === 'in-progress');
  }
  if (!active) throw new ApiError(409, 'No attempts remaining');
  res.json({ attempt: publicAttempt(active, ledger._id, ledger.attempts.indexOf(active) + 1) });
});
async function ownAttempt(req) {
  const ledger = await AssessmentLedger.findOne({ _id: req.params.ledgerId, student: req.user._id, organization: req.user.organization });
  const attempt = ledger?.attempts.id(req.params.attemptId);
  if (!attempt) throw new ApiError(404, 'Attempt not found');
  return { ledger, attempt };
}
export const saveAnswers = asyncHandler(async (req, res) => {
  const { ledger, attempt } = await ownAttempt(req);
  if (!validateAnswers(req.body.answers, attempt.questions.length)) throw new ApiError(400, 'Invalid answers');
  const result = await AssessmentLedger.updateOne({ _id: ledger._id, attempts: { $elemMatch: { _id: attempt._id, status: 'in-progress', dueAt: { $gte: new Date() } } } }, { $set: { 'attempts.$.answers': req.body.answers } });
  if (!result.matchedCount) throw new ApiError(409, 'Attempt has ended; submit your saved answers');
  res.json({ message: 'Answers saved' });
});
export const submitAttempt = asyncHandler(async (req, res) => {
  const { ledger, attempt } = await ownAttempt(req);
  if (attempt.status !== 'in-progress') return res.json({ attempt: publicAttempt(attempt, ledger._id, ledger.attempts.indexOf(attempt) + 1) });
  if (!validateAnswers(req.body.answers, attempt.questions.length)) throw new ApiError(400, 'Invalid answers');
  const now = new Date();
  // Late submissions only finalize answers already saved before the deadline.
  const answers = +now > +attempt.dueAt ? attempt.answers : req.body.answers;
  const marks = autoMarks(attempt.questions, answers, attempt.negativeMarking);
  const requiresReview = marks.some(mark => mark === null);
  await AssessmentLedger.updateOne({ _id: ledger._id, attempts: { $elemMatch: { _id: attempt._id, status: 'in-progress' } } }, { $set: { 'attempts.$.answers': answers, 'attempts.$.marks': marks, 'attempts.$.submittedAt': now, 'attempts.$.status': requiresReview ? 'submitted' : 'graded', 'attempts.$.score': requiresReview ? null : Math.max(0, marks.reduce((sum, mark) => sum + (mark || 0), 0)), 'attempts.$.gradedAt': requiresReview ? null : now } });
  const updated = await AssessmentLedger.findById(ledger._id); const final = updated.attempts.id(attempt._id);
  res.json({ attempt: publicAttempt(final, ledger._id, updated.attempts.indexOf(final) + 1) });
});
export const reviewQueue = asyncHandler(async (req, res) => {
  const students = await User.find(await managedStudents(req.user)).select('_id');
  const ledgers = await AssessmentLedger.find({ organization: req.user.organization, student: { $in: students.map(student => student._id) }, 'attempts.status': 'submitted' }).populate('student', 'name registrationNumber').lean();
  res.json({ attempts: ledgers.flatMap(ledger => ledger.attempts.filter(attempt => attempt.status === 'submitted').map(attempt => ({ ...publicAttempt(attempt, ledger._id, ledger.attempts.indexOf(attempt) + 1), student: ledger.student, automaticMarks: attempt.marks }))) });
});
export const gradeAttempt = asyncHandler(async (req, res) => {
  const ledger = await AssessmentLedger.findOne({ _id: req.params.ledgerId, organization: req.user.organization });
  if (!ledger) throw new ApiError(404, 'Attempt not found');
  await requireStudent(req.user, ledger.student);
  const attempt = ledger.attempts.id(String(req.params.attemptId));
  if (!attempt || attempt.status !== 'submitted') throw new ApiError(409, 'This attempt is not awaiting review');
  if (!Array.isArray(req.body.marks) || req.body.marks.length !== attempt.questions.length || typeof req.body.rubric !== 'string' || !req.body.rubric.trim() || req.body.rubric.length > 5000 || typeof req.body.feedback !== 'string' || !req.body.feedback.trim() || req.body.feedback.length > 5000) throw new ApiError(400, 'Supply marks, a rubric, and feedback');
  const marks = attempt.questions.map((question, index) => {
    if (automaticTypes.has(question.type)) return attempt.marks[index];
    if (!finite(req.body.marks[index], 0, question.marks)) throw new ApiError(400, `Invalid marks for question ${index + 1}`);
    return req.body.marks[index];
  });
  const result = await AssessmentLedger.updateOne({ _id: ledger._id, attempts: { $elemMatch: { _id: attempt._id, status: 'submitted' } } }, { $set: { 'attempts.$.status': 'graded', 'attempts.$.score': Math.max(0, marks.reduce((sum, mark) => sum + mark, 0)), 'attempts.$.marks': marks, 'attempts.$.gradedAt': new Date(), 'attempts.$.gradedBy': req.user._id, 'attempts.$.rubric': req.body.rubric, 'attempts.$.feedback': req.body.feedback } });
  if (!result.matchedCount) throw new ApiError(409, 'This attempt was already reviewed');
  res.json({ message: 'Review recorded. Readiness now includes this evaluation.' });
});
