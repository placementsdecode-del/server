export type SkillRule = { key: string; label: string; weight: number; minimum: number; mandatory: boolean };
export type Policy = { key: string; label: string; version: number; skills: SkillRule[]; minSamples: number; freshnessDays: number; halfLifeDays: number; readyScore: number; almostScore: number; minCgpa?: number | null; maxBacklogs?: number | null; graduationYears?: number[] };
export type Evidence = { id: string; reference: string; skill: string; title: string; source: string; difficulty: string; score: number; maxScore: number; at: Date | string };
export const skillKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const defaultPolicy: Policy = {
  key: 'software-developer', label: 'Software Developer', version: 1, minSamples: 3, freshnessDays: 90, halfLifeDays: 45, readyScore: 8.5, almostScore: 7,
  skills: [ ['coding', 'Coding', 25, 7], ['dsa', 'DSA', 20, 6.5], ['problem-solving', 'Problem Solving', 15, 7], ['aptitude', 'Aptitude', 15, 6.5], ['communication', 'Communication', 15, 6], ['interview', 'Interview', 10, 6] ].map(([key, label, weight, minimum]) => ({ key: String(key), label: String(label), weight: Number(weight), minimum: Number(minimum), mandatory: true })),
  minCgpa: null, maxBacklogs: null, graduationYears: [],
};
const round = (value: number) => Math.round(value * 100) / 100;
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const DAY = 86400000;
export function calculateReadiness(all: Evidence[], policy: Policy, from: Date, to: Date) {
  const eligibleEvidence = all.filter(item => item.source !== 'self-reported' && +new Date(item.at) <= +to && Number.isFinite(item.score) && item.maxScore > 0 && item.score >= 0 && item.score <= item.maxScore);
  const evidence = eligibleEvidence.filter(item => +new Date(item.at) >= +from);
  const skills = policy.skills.map(rule => {
    const records = eligibleEvidence.filter(item => item.skill === rule.key).sort((a, b) => +new Date(a.at) - +new Date(b.at));
    const distinct = new Map<string, Evidence[]>();
    for (const record of records) distinct.set(record.reference, [...(distinct.get(record.reference) || []), record]);
    // Retries demonstrate improvement, but never count as independent tests.
    const samples = [...distinct.values()].filter(attempts => +new Date(attempts[attempts.length - 1].at) >= +from).map(attempts => {
      const first = attempts[0], latest = attempts[attempts.length - 1];
      const firstScore = first.score / first.maxScore * 10, latestScore = latest.score / latest.maxScore * 10;
      return { value: firstScore * 0.7 + latestScore * 0.3, firstScore, latestScore, at: latest.at, difficulty: latest.difficulty };
    });
    const weighted = samples.map(sample => ({ ...sample, weight: Math.pow(0.5, Math.max(0, (+to - +new Date(sample.at)) / DAY) / policy.halfLifeDays) }));
    const score = weighted.length ? round(weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / weighted.reduce((sum, item) => sum + item.weight, 0)) : null;
    const recentSamples = samples.filter(item => +to - +new Date(item.at) <= policy.freshnessDays * DAY).length;
    const lastAt = records.length ? new Date(records[records.length - 1].at).toISOString() : null;
    const enough = recentSamples >= policy.minSamples;
    // Dispersion and trends are only compared within the same difficulty level.
    const difficulties = ['beginner', 'intermediate', 'advanced'].map(difficulty => {
      const values = samples.filter(sample => sample.difficulty === difficulty).sort((a, b) => +new Date(a.at) - +new Date(b.at));
      const scores = values.map(value => value.value);
      const deviation = scores.length >= 3 ? Math.sqrt(average(scores.map(value => (value - average(scores)) ** 2))) : null;
      const half = Math.floor(values.length / 2);
      const change = values.length >= 4 ? round(average(scores.slice(half)) - average(scores.slice(0, half))) : null;
      return { difficulty, samples: values.length, score: scores.length ? round(average(scores)) : null, deviation: deviation === null ? null : round(deviation), change };
    });
    const comparableChanges = difficulties.filter(item => item.change !== null);
    const change = comparableChanges.length ? round(average(comparableChanges.map(item => item.change!))) : null;
    const consistency = difficulties.some(item => item.deviation !== null && item.deviation > 2) ? 'Variable' : difficulties.some(item => item.deviation !== null) ? 'Consistent' : 'Insufficient evidence';
    return { ...rule, score, samples: samples.length, recentSamples, attempts: records.length, lastAt, enough, change,
      trend: change === null ? 'Insufficient evidence' : change >= 1.5 ? 'Strong improvement' : change >= 0.5 ? 'Improving' : change <= -0.5 ? 'Declining' : 'Stable',
      consistency, difficulties, firstAverage: samples.length ? round(average(samples.map(item => item.firstScore))) : null, latestAverage: samples.length ? round(average(samples.map(item => item.latestScore))) : null,
      recommendation: !enough ? `Complete ${Math.max(0, policy.minSamples - recentSamples)} more distinct recent ${rule.label} evaluations.` : score! < rule.minimum ? `Practise ${rule.label} and complete a reviewed assessment; target ${rule.minimum}/10.` : consistency === 'Variable' ? `Build consistency in ${rule.label} with comparable practice.` : `Maintain ${rule.label} with fresh interview-level practice.`,
    };
  });
  const available = skills.filter(skill => skill.score !== null);
  const observedWeight = available.reduce((sum, skill) => sum + skill.weight, 0);
  const totalWeight = skills.reduce((sum, skill) => sum + skill.weight, 0);
  const overall = observedWeight ? round(available.reduce((sum, skill) => sum + skill.score! * skill.weight, 0) / observedWeight) : null;
  const required = skills.filter(skill => skill.mandatory);
  const missing = required.filter(skill => !skill.enough);
  const gaps = required.filter(skill => skill.score !== null && skill.score < skill.minimum);
  const declining = required.filter(skill => skill.change !== null && skill.change <= -0.5);
  const variable = required.filter(skill => skill.consistency === 'Variable');
  let status = overall === null || missing.length ? 'Insufficient Evidence' : overall >= policy.readyScore ? 'Placement Ready' : overall >= policy.almostScore ? 'Almost Ready' : overall >= 5 ? 'Needs Improvement' : 'Not Ready';
  if (status === 'Placement Ready' && (gaps.length || declining.length || variable.length)) status = 'Almost Ready';
  const reasons = [...missing.map(skill => `${skill.label}: ${skill.recentSamples}/${policy.minSamples} recent independent evaluations`), ...gaps.map(skill => `${skill.label}: ${skill.score}/10 is below ${skill.minimum}/10`), ...declining.map(skill => `${skill.label}: declining comparable performance`), ...variable.map(skill => `${skill.label}: variable comparable performance`)];
  if (overall !== null && overall < policy.readyScore) reasons.push(`Overall ${overall}/10 is below ${policy.readyScore}/10`);
  return { overall, status, provisional: missing.length > 0 || available.length !== skills.length, coverage: round(totalWeight ? observedWeight / totalWeight * 100 : 0), skills, reasons, evidenceCount: evidence.length,
    formula: 'Recency-weighted independent evaluations; each uses 70% first attempt + 30% latest attempt. Missing skills are excluded from the provisional average, never treated as zero. Mandatory evidence and skill thresholds gate readiness. Time/speed does not add score.',
    evidenceIds: eligibleEvidence.filter(item => evidence.some(recent => recent.reference === item.reference && recent.skill === item.skill)).map(item => item.id), algorithmVersion: 'readiness-v1',
  };
}
export function eligibility(report: ReturnType<typeof calculateReadiness>, policy: Policy, academics?: { cgpa?: number; backlogs?: number; graduationYear?: number } | null) {
  const reasons = [...report.reasons];
  if (policy.minCgpa !== null && policy.minCgpa !== undefined && (academics?.cgpa === null || academics?.cgpa === undefined || academics.cgpa < policy.minCgpa)) reasons.push(`CGPA must be at least ${policy.minCgpa}; ${academics?.cgpa ?? 'not recorded'}`);
  if (policy.maxBacklogs !== null && policy.maxBacklogs !== undefined && (academics?.backlogs === null || academics?.backlogs === undefined || academics.backlogs > policy.maxBacklogs)) reasons.push(`Backlogs must be at most ${policy.maxBacklogs}; ${academics?.backlogs ?? 'not recorded'}`);
  if (policy.graduationYears?.length && !policy.graduationYears.includes(academics?.graduationYear!)) reasons.push(`Graduation year must be ${policy.graduationYears.join(', ')}; ${academics?.graduationYear ?? 'not recorded'}`);
  return { status: report.status === 'Placement Ready' && !reasons.length ? 'Eligible' : report.overall !== null && report.overall >= policy.almostScore && report.status !== 'Insufficient Evidence' ? 'Nearly Eligible' : 'Not Eligible', reasons };
}
