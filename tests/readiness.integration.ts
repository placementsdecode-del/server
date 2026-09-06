import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import User from '../src/models/User';
import Section from '../src/models/Section';
import AssessmentLedger from '../src/models/AssessmentLedger';
import { LearningPulse, ShortlistDecision } from '../src/models/Readiness';
async function main() {
  const folder = await mkdtemp(join(tmpdir(), 'placement-community-test-'));
  const mongo = spawn('/usr/bin/mongod', ['--dbpath', folder, '--bind_ip', '127.0.0.1', '--port', '27963', '--quiet'], { stdio: 'ignore' });
  let server;
  process.env.JWT_SECRET = 'isolated-community-integration-secret';
  try {
    // Only connect after our own isolated database reports ready, never an existing service.
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(resolve, 1500); mongo.once('exit', code => { clearTimeout(timer); reject(new Error(`Test database exited: ${code}`)); }); mongo.once('error', reject); });
    await mongoose.connect('mongodb://127.0.0.1:27963/community_test', { serverSelectionTimeoutMS: 10000 });
    const org = new mongoose.Types.ObjectId(); const otherOrg = new mongoose.Types.ObjectId();
    const [admin, teacher, alice, bob, outsider, unrelated] = Array.from({ length: 6 }, () => new mongoose.Types.ObjectId());
    const section = await Section.create({ organization: org, name: 'Section A', code: 'A', department: 'CSE', batch: '2026', academicYear: '2026-27', assignedTeachers: [teacher] });
    const otherSection = await Section.create({ organization: otherOrg, name: 'Section A', code: 'A', department: 'CSE', batch: '2026', academicYear: '2026-27' });
    await User.collection.insertMany([
      { _id: admin, organization: org, roleName: 'admin', name: 'Admin' },
      { _id: teacher, organization: org, roleName: 'teacher', name: 'Coordinator' },
      { _id: alice, organization: org, roleName: 'student', name: 'Alice', section: section._id },
      { _id: bob, organization: org, roleName: 'student', name: 'Bob', section: section._id },
      { _id: outsider, organization: otherOrg, roleName: 'student', name: 'Other org student', section: otherSection._id },
      { _id: unrelated, organization: org, roleName: 'student', name: 'Unassigned student' },
    ].map((user, index) => ({ ...user, email: `test${index}@example.test`, registrationNumber: `R${index}`, status: 'active', role: null })));
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function request(user, path, method = 'GET', body?, status = 200) {
      const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${jwt.sign({ sub: user.toString() }, process.env.JWT_SECRET!)}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json(); assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`); return result;
    }
    const defaults = await request(alice, '/readiness/policies'); assert.ok(defaults.policies.length);
    const config = { key: 'test-role', label: 'Test Developer', skills: [{ key: 'coding', label: 'Coding', weight: 100, minimum: 7, mandatory: true }], minSamples: 3, freshnessDays: 90, halfLifeDays: 45, readyScore: 8.5, almostScore: 7, minCgpa: 7, maxBacklogs: 0, graduationYears: [2026] };
    const { policy } = await request(teacher, '/readiness/policies', 'POST', config, 201);
    const query = `?policy=${policy._id}&months=3`;
    assert.equal((await request(alice, '/readiness/me' + query)).overall, null);
    await request(alice, '/readiness/policies', 'POST', config, 403);
    await request(alice, `/readiness/students/${bob}`, 'GET', undefined, 403);
    await request(teacher, `/readiness/students/${outsider}`, 'GET', undefined, 404);
    const practice = { requestId: 'practice-001', reference: 'arrays-1', title: 'Arrays practice', skill: 'coding', difficulty: 'intermediate', solved: true, submissions: 3, score: 100, maxScore: 100, source: 'instructor-rated' };
    await request(alice, '/readiness/evidence', 'POST', practice, 201);
    await request(alice, '/readiness/evidence', 'POST', practice, 201);
    let report = await request(alice, '/readiness/me' + query); assert.equal(report.overall, null); assert.equal(report.activity.problemsAttempted, 1); assert.equal(report.activity.problemsSolved, 1);
    await request(alice, '/readiness/activity', 'POST', { seconds: 31, context: 'Study Materials' }, 400);
    await Promise.all([1, 2, 3].map(() => request(alice, '/readiness/activity', 'POST', { seconds: 30, context: 'Study Materials' })));
    assert.equal(await LearningPulse.countDocuments({ student: alice }), 1);
    await request(teacher, `/readiness/students/${alice}/academics`, 'POST', { cgpa: 8, backlogs: 0, graduationYear: 2026, reason: 'Verified transcript' }, 201);
    for (const id of [1, 2, 3]) await request(teacher, '/readiness/evidence', 'POST', { requestId: `evaluation-00${id}`, reference: `independent-test-${id}`, title: `Coding test ${id}`, skill: 'coding', difficulty: 'intermediate', score: 90, maxScore: 100, rubric: 'Correctness 70%, reasoning 30%', studentId: alice.toString() }, 201);
    report = await request(alice, '/readiness/me' + query); assert.equal(report.overall, 9); assert.equal(report.status, 'Placement Ready'); assert.equal(report.eligibility.status, 'Eligible');
    await request(teacher, `/readiness/students/${alice}/decisions${query}`, 'POST', { decision: 'Hold', reason: 'Schedule a communication review before interviewing' }, 201);
    const decision = await ShortlistDecision.findOne({ student: alice }).lean(); assert.equal(decision.snapshot.overall, 9); assert.equal(decision.snapshot.evidenceIds.length, 3); assert.equal(decision.snapshot.policy.version, 1);
    const { policy: revised } = await request(teacher, '/readiness/policies', 'POST', { ...config, minCgpa: 9 }, 201);
    assert.equal(revised.version, 2); assert.equal((await request(alice, '/readiness/me' + query)).eligibility.status, 'Eligible');
    assert.notEqual((await request(alice, `/readiness/me?policy=${revised._id}`)).eligibility.status, 'Eligible');
    await request(alice, '/readiness/consent', 'POST', { granted: true }); assert.equal((await request(alice, '/readiness/me' + query)).hrSharingConsent, true);
    await request(alice, '/readiness/consent', 'POST', { granted: false }); assert.equal((await request(alice, '/readiness/me' + query)).hrSharingConsent, false);
    const assessmentPayload = { title: 'Timed coding knowledge', category: 'coding', difficulty: 'intermediate', instructions: 'Select the correct answer.', durationMinutes: 10, totalMarks: 10, passingMarks: 7, attemptsAllowed: 3, status: 'active', assignedSections: [section.id], questions: [{ type: 'single-choice', text: 'Which collection uses LIFO?', options: ['Stack', 'Queue'], correctAnswer: 'Stack', marks: 10 }] };
    const { assessment } = await request(teacher, '/assessments', 'POST', assessmentPayload, 201);
    const concurrent = await Promise.all([1, 2, 3].map(() => request(alice, `/readiness/assessments/${assessment._id}/start`, 'POST')));
    const attempt = concurrent[0].attempt; assert.ok(concurrent.every(result => result.attempt.id === attempt.id)); assert.equal(attempt.questions[0].correctAnswer, undefined);
    const path = `/readiness/attempts/${attempt.ledgerId}/${attempt.id}`;
    await request(alice, path + '/answers', 'PATCH', { answers: ['Stack'] });
    const completed = await request(alice, path + '/submit', 'POST', { answers: ['Stack'], score: 100 }); assert.equal(completed.attempt.score, 10);
    const duplicate = await request(alice, path + '/submit', 'POST', { answers: ['Queue'] }); assert.equal(duplicate.attempt.score, 10);
    const second = (await request(alice, `/readiness/assessments/${assessment._id}/start`, 'POST')).attempt;
    await request(alice, `/readiness/attempts/${second.ledgerId}/${second.id}/answers`, 'PATCH', { answers: ['Stack'] });
    await AssessmentLedger.updateOne({ _id: second.ledgerId, 'attempts._id': second.id }, { $set: { 'attempts.$.dueAt': new Date(Date.now() - 1000) } });
    await request(alice, `/readiness/attempts/${second.ledgerId}/${second.id}/answers`, 'PATCH', { answers: ['Queue'] }, 409);
    assert.equal((await request(alice, `/readiness/attempts/${second.ledgerId}/${second.id}/submit`, 'POST', { answers: ['Queue'] })).attempt.score, 10);
    const third = (await request(alice, `/readiness/assessments/${assessment._id}/start`, 'POST')).attempt;
    await request(alice, `/readiness/attempts/${third.ledgerId}/${third.id}/submit`, 'POST', { answers: ['Queue'] });
    await request(alice, `/readiness/assessments/${assessment._id}/start`, 'POST', undefined, 409);
    const subjective = (await request(teacher, '/assessments', 'POST', { ...assessmentPayload, title: 'Explain a solution', attemptsAllowed: 1, questions: [{ type: 'coding', text: 'Explain your algorithm', marks: 10 }] }, 201)).assessment;
    const written = (await request(alice, `/readiness/assessments/${subjective._id}/start`, 'POST')).attempt;
    const writtenPath = `/readiness/attempts/${written.ledgerId}/${written.id}`;
    assert.equal((await request(alice, writtenPath + '/submit', 'POST', { answers: ['Use a stack and explain complexity.'] })).attempt.status, 'submitted');
    await request(alice, writtenPath + '/review', 'POST', { marks: [10], rubric: 'Fake', feedback: 'Fake' }, 403);
    await request(teacher, writtenPath + '/review', 'POST', { marks: [11], rubric: 'Correctness', feedback: 'Good' }, 400);
    await request(teacher, writtenPath + '/review', 'POST', { marks: [8], rubric: 'Correctness and complexity analysis', feedback: 'Explain the space complexity too.' });
    await request(teacher, writtenPath + '/review', 'POST', { marks: [10], rubric: 'Changed', feedback: 'Changed' }, 409);
    report = await request(alice, '/readiness/me' + query); assert.equal(report.activity.gradedAttempts, 4); assert.equal(report.activity.assessmentsCompleted, 2);
    const cohort = await request(teacher, '/readiness/students' + query); assert.equal(cohort.students.length, 2);
    assert.equal(cohort.students.find(row => row.student.name === 'Alice').decision.decision, 'Hold');
    console.log('PASS: readiness database/HTTP integration: scoring, evidence provenance, scopes, policy versions, snapshots, academic gates, consent, time deduplication, concurrent attempts, deadlines, immutable grades and reviews.');
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await mongoose.disconnect(); mongo.kill('SIGTERM');
    if (mongo.exitCode === null && mongo.signalCode === null) await new Promise(resolve => mongo.once('exit', resolve));
    await rm(folder, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
