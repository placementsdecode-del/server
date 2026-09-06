import AssessmentLedger from '../../models/AssessmentLedger';
import { ReadinessPolicy, ReadinessEvidence, LearningPulse, AcademicRecord, ShortlistDecision, ReadinessConsent } from '../../models/Readiness';
import { calculateReadiness, defaultPolicy, eligibility, Evidence, Policy } from './scoring';
import ApiError from '../../utils/apiError';
export async function policies(organization) {
  await ReadinessPolicy.updateOne({ organization, key: defaultPolicy.key, version: 1 }, { $setOnInsert: { ...defaultPolicy, organization } }, { upsert: true });
  return ReadinessPolicy.find({ organization }).sort({ key: 1, version: -1 }).lean();
}
export function dateRange(query) {
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date();
  const months = Number(query.months || 3);
  if (!query.from && ![3, 4, 6].includes(months)) throw new ApiError(400, 'Choose a 3, 4, or 6 month window, or custom dates');
  const from = query.from ? new Date(`${query.from}T00:00:00Z`) : new Date(to);
  if (!query.from) { const day = from.getUTCDate(); from.setUTCDate(1); from.setUTCMonth(from.getUTCMonth() - months); const lastDay = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0)).getUTCDate(); from.setUTCDate(Math.min(day, lastDay)); }
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || +from > +to || +to > Date.now() + 86400000 || +to - +from > 730 * 86400000) throw new ApiError(400, 'Choose a valid date range of at most two years');
  return { from, to };
}
export async function buildReport(student, policy, range) {
  const { from, to } = range;
  const [ledgers, manual, pulses, academic, decisions, consent] = await Promise.all([
    AssessmentLedger.find({ student: student._id, organization: student.organization }).lean(),
    ReadinessEvidence.find({ student: student._id, organization: student.organization, createdAt: { $lte: to } }).sort({ createdAt: 1 }).lean(),
    LearningPulse.find({ student: student._id, organization: student.organization, createdAt: { $gte: from, $lte: to } }).lean(),
    AcademicRecord.findOne({ student: student._id, organization: student.organization, createdAt: { $lte: to } }).sort({ createdAt: -1 }).lean(),
    ShortlistDecision.find({ student: student._id, organization: student.organization, policy: policy._id }).select('decision reason createdAt recordedBy').populate('recordedBy', 'name').sort({ createdAt: -1 }).limit(20).lean(),
    ReadinessConsent.findOne({ student: student._id, organization: student.organization }).sort({ createdAt: -1 }).lean(),
  ]);
  const attempts = ledgers.flatMap(ledger => ledger.attempts.map((attempt, index) => ({ ...attempt, ledgerId: ledger._id, assessmentId: ledger.assessment, attemptNumber: index + 1 })));
  const evidence: Evidence[] = [
    ...manual.map(item => ({ id: String(item._id), reference: `manual:${item.skill}:${item.reference}`, skill: item.skill, title: item.title, source: item.source, difficulty: item.difficulty, score: item.score, maxScore: item.maxScore, at: item.createdAt })),
    ...attempts.filter(attempt => attempt.status === 'graded').map(attempt => ({ id: String(attempt._id), reference: `assessment:${attempt.assessmentId}`, skill: attempt.skill, title: attempt.title, source: attempt.gradedBy ? 'instructor-rated' : 'auto-graded', difficulty: attempt.difficulty, score: attempt.score, maxScore: attempt.totalMarks, at: attempt.gradedAt })),
  ];
  const report = calculateReadiness(evidence, policy as unknown as Policy, from, to);
  const inWindow = evidence.filter(item => +new Date(item.at) >= +from && +new Date(item.at) <= +to);
  const problemRecords = manual.filter(item => item.kind === 'problem' && +item.createdAt >= +from && +item.createdAt <= +to);
  const daySeconds = new Map<string, number>();
  for (const pulse of pulses) { const day = pulse.createdAt.toISOString().slice(0, 10); daySeconds.set(day, (daySeconds.get(day) || 0) + pulse.seconds); }
  const daily = [...daySeconds].sort(([a], [b]) => a.localeCompare(b)).map(([day, seconds]) => ({ day, minutes: Math.round(seconds / 60 * 10) / 10 }));
  let streak = 0; const cursor = new Date(to); cursor.setUTCHours(0, 0, 0, 0);
  if (!daySeconds.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while ((daySeconds.get(cursor.toISOString().slice(0, 10)) || 0) >= 60) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  const history = Array.from({ length: 6 }, (_, index) => {
    const at = new Date(+from + (+to - +from) * (index + 1) / 6);
    const value = calculateReadiness(evidence, policy as unknown as Policy, from, at);
    return { at: at.toISOString(), overall: value.overall, status: value.status, evidenceCount: value.evidenceCount };
  });
  return { ...report, eligibility: eligibility(report, policy as unknown as Policy, academic),
    student: { id: student._id, name: student.name, registrationNumber: student.registrationNumber, department: student.department, batch: student.batch, section: student.section },
    policy, range: { from, to }, academics: academic, decisions, hrSharingConsent: !!consent?.granted, history, daily,
    activity: { activeMinutes: Math.round(pulses.reduce((sum, pulse) => sum + pulse.seconds, 0) / 60 * 10) / 10, activeDays: daily.filter(day => day.minutes >= 1).length, streak,
      problemsAttempted: new Set(problemRecords.map(item => `${item.skill}:${item.reference}`)).size,
      problemsSolved: new Set(problemRecords.filter(item => item.solved).map(item => `${item.skill}:${item.reference}`)).size,
      submissions: problemRecords.reduce((sum, item) => sum + (item.submissions || 0), 0),
      problemEvidenceSource: 'Self-reported practice; excluded from readiness score',
      assessmentsCompleted: new Set(attempts.filter(attempt => attempt.submittedAt && +attempt.submittedAt >= +from && +attempt.submittedAt <= +to).map(attempt => String(attempt.assessmentId))).size,
      gradedAttempts: attempts.filter(attempt => attempt.status === 'graded' && +attempt.gradedAt >= +from && +attempt.gradedAt <= +to).length,
      pendingReview: attempts.filter(attempt => attempt.status === 'submitted').length,
    },
    evidence: inWindow.map(item => ({ ...item, percentage: item.maxScore ? Math.round(item.score / item.maxScore * 10000) / 100 : null })).sort((a, b) => +new Date(b.at) - +new Date(a.at)),
  };
}
