import { codingProblems, codingLanguages } from '../data/coding-problems';
import CodingSubmission from '../models/CodingSubmission';
import { ReadinessEvidence } from '../models/Readiness';
import ApiError from '../utils/apiError';
import asyncHandler from '../utils/asyncHandler';

async function codebox(path: string, body: object | undefined, owner: string) {
  if (!process.env.CODEBOX_URL || !process.env.CODEBOX_TOKEN) throw new ApiError(503, 'Code execution is unavailable. Please contact your administrator.');
  try {
    const response = await fetch(`${process.env.CODEBOX_URL.replace(/\/$/, '')}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': process.env.CODEBOX_TOKEN, 'X-Submission-Owner': owner },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Code execution request failed');
    return await response.json();
  } catch {
    throw new ApiError(503, 'Code execution is temporarily unavailable. Please try again.');
  }
}

function publicSubmission(submission) {
  return { id: submission._id, problemId: submission.problemId, languageId: submission.languageId, mode: submission.mode,
    active: submission.active, status: submission.status, passed: submission.passed, total: submission.total, output: submission.output };
}
export const listProblems = asyncHandler(async (req, res) => {
  const recent = await CodingSubmission.find({ organization: req.user.organization, student: req.user._id }).sort({ createdAt: -1 }).limit(20).lean();
  res.json({ configured: !!(process.env.CODEBOX_URL && process.env.CODEBOX_TOKEN), languages: codingLanguages,
    problems: codingProblems.map(({ tests, ...problem }) => ({ ...problem, sample: tests[0] })), recent: recent.map(publicSubmission) });
});

export const createCodingSubmission = asyncHandler(async (req, res) => {
  const { problemId, languageId, source, mode, requestId } = req.body;
  const problem = codingProblems.find(item => item.id === problemId);
  if (!problem || !codingLanguages.some(item => item.id === languageId) || !['run', 'submit'].includes(mode) || typeof source !== 'string' || !source.trim() || source.length > 30000 || typeof requestId !== 'string' || !/^[\w-]{8,80}$/.test(requestId)) throw new ApiError(400, 'Choose a problem, language, source code, and request ID');
  const owner = { organization: req.user.organization, student: req.user._id };
  const previous = await CodingSubmission.findOne({ ...owner, requestId });
  if (previous) return res.json({ submission: publicSubmission(previous) });
  if (!process.env.CODEBOX_URL || !process.env.CODEBOX_TOKEN) throw new ApiError(503, 'Code execution is unavailable. Please contact your administrator.');
  await CodingSubmission.updateMany({ ...owner, active: true, createdAt: { $lt: new Date(Date.now() - 600000) } }, { $set: { active: false, status: 'Execution timed out' } });
  const tests = mode === 'run' ? problem.tests.slice(0, 1) : problem.tests;
  let submission;
  try {
    submission = await CodingSubmission.create({ ...owner, requestId, problemId, languageId, source, mode, total: tests.length });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await CodingSubmission.findOne({ ...owner, requestId });
      if (duplicate) return res.json({ submission: publicSubmission(duplicate) });
      throw new ApiError(409, 'Wait for your current submission to finish');
    }
    throw error;
  }
  try {
    for (const test of tests) {
      const result = await codebox('/submissions?wait=false', { source_code: source, language_id: languageId,
        stdin: test.input, expected_output: test.output, cpu_time_limit: 2, wall_time_limit: 5, memory_limit: 128000, enable_network: false }, String(req.user._id));
      if (typeof result.token !== 'string') throw new ApiError(503, 'Code execution returned an invalid response');
      submission.tokens.push(result.token);
      await submission.save();
    }
  } catch (error) {
    submission.active = false;
    submission.status = 'Execution unavailable';
    await submission.save();
    throw error;
  }
  res.status(201).json({ submission: publicSubmission(submission) });
});

export const getCodingSubmission = asyncHandler(async (req, res) => {
  const submission = await CodingSubmission.findOne({ _id: req.params.submissionId, organization: req.user.organization, student: req.user._id });
  if (!submission) throw new ApiError(404, 'Submission not found');
  if (submission.active && +submission.createdAt < Date.now() - 600000) {
    submission.active = false; submission.status = 'Execution timed out'; await submission.save();
  }
  if (submission.active && submission.tokens.length === submission.total) {
    const results = await Promise.all(submission.tokens.map(token => codebox(`/submissions/${encodeURIComponent(token)}`, undefined, String(req.user._id))));
    if (results.every(result => Number.isInteger(result.status?.id) && result.status.id > 2)) {
      const passed = results.filter(result => result.status.id === 3).length;
      const failure = results.find(result => result.status.id !== 3);
      const status = passed === submission.total ? 'Accepted' : failure.status.description;
      const output = submission.mode === 'run' ? String(failure?.compile_output || failure?.stderr || results[0].stdout || '').slice(0, 10000) : '';
      await CodingSubmission.updateOne({ _id: submission._id, active: true }, { $set: { active: false, passed, status, output } });
      submission.active = false; submission.passed = passed; submission.status = status; submission.output = output;
    } else if (+submission.createdAt < Date.now() - 600000) {
      submission.active = false; submission.status = 'Execution timed out'; await submission.save();
    }
  }
  if (!submission.active && submission.mode === 'submit' && !['Execution timed out', 'Execution unavailable', 'Internal Error'].includes(submission.status) && submission.tokens.length === submission.total) {
    const problem = codingProblems.find(item => item.id === submission.problemId);
    await ReadinessEvidence.updateOne({ student: submission.student, requestId: `coding-${submission._id}` }, { $setOnInsert: {
      organization: submission.organization, student: submission.student, requestId: `coding-${submission._id}`,
      reference: `coding:${submission.problemId}`, skill: 'coding', title: problem.title, kind: 'problem', source: 'auto-graded',
      difficulty: problem.difficulty, solved: submission.passed === submission.total, submissions: 1,
      testCasesPassed: submission.passed, testCasesTotal: submission.total, score: submission.passed, maxScore: submission.total,
    } }, { upsert: true });
  }
  res.json({ submission: publicSubmission(submission) });
});
