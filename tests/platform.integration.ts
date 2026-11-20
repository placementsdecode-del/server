import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import User from '../src/models/User';
import Role from '../src/models/Role';
import AcceptedOrganization from '../src/models/AcceptedOrganization';
import Section from '../src/models/Section';
import AssessmentLedger from '../src/models/AssessmentLedger';
import { ReadinessEvidence } from '../src/models/Readiness';
import { ensureOrganizationRoles, ensureRole } from '../src/services/rbac.service';

async function main() {
  const folder = await mkdtemp(join(tmpdir(), 'placement-platform-test-'));
  const mongo = spawn('/usr/bin/mongod', ['--dbpath', folder, '--bind_ip', '127.0.0.1', '--port', '27964', '--quiet'], { stdio: 'ignore' });
  let server; let executor;
  process.env.JWT_SECRET = 'isolated-platform-regression-secret';
  delete process.env.SMTP_HOST;
  try {
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(resolve, 1500); mongo.once('exit', code => { clearTimeout(timer); reject(new Error(`Database exited ${code}`)); }); mongo.once('error', reject); });
    await mongoose.connect('mongodb://127.0.0.1:27964/platform_test', { serverSelectionTimeoutMS: 10000 });
    const org = await AcceptedOrganization.create({ registrationRequest: new mongoose.Types.ObjectId(), orgName: 'First College', orgEmail: 'first@example.test', address: 'Campus', phoneNumber: '1234567890', acceptedBy: new mongoose.Types.ObjectId() });
    const otherOrg = await AcceptedOrganization.create({ registrationRequest: new mongoose.Types.ObjectId(), orgName: 'Second College', orgEmail: 'second@example.test', address: 'Campus', phoneNumber: '1234567891', acceptedBy: new mongoose.Types.ObjectId() });
    const roles = await ensureOrganizationRoles(org._id);
    const superRole = await ensureRole('superadmin');
    const superadmin = await User.create({ name: 'Owner', email: 'owner@example.test', password: 'ExamplePass99!', role: superRole._id, roleName: 'superadmin' });
    const admin = await User.create({ name: 'Admin', email: 'admin@example.test', password: 'ExamplePass99!', role: roles.admin._id, roleName: 'admin', organization: org._id });
    const teacher = await User.create({ name: 'Teacher', email: 'teacher@example.test', password: 'ExamplePass99!', role: roles.teacher._id, roleName: 'teacher', organization: org._id });
    const student = await User.create({ name: 'Learner', email: 'learner@example.test', password: 'ExamplePass99!', role: roles.student._id, roleName: 'student', organization: org._id });
    const outsider = await User.create({ name: 'Other Learner', email: 'other@example.test', password: 'ExamplePass99!', role: roles.student._id, roleName: 'student', organization: otherOrg._id });
    const section = await Section.create({ organization: org._id, name: 'Cohort', code: 'A', department: 'CSE', batch: '2026', academicYear: '2026', assignedTeachers: [teacher._id] });
    await User.updateOne({ _id: student._id }, { $set: { section: section._id } });
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function request(user, path: string, method = 'GET', body?, expected = 200) {
      const response = await fetch(base + path, { method, headers: { ...(user ? { Authorization: `Bearer ${jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET!)}` } : {}), 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json(); assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`); return result;
    }
    await request(null, '/auth/login', 'POST', { email: {}, password: 'x' }, 400);
    const login = await request(null, '/auth/login', 'POST', { email: ' LEARNER@EXAMPLE.TEST ', password: 'ExamplePass99!' });
    assert.ok(login.token);
    await request(student, '/auth/password', 'PATCH', { currentPassword: 'ExamplePass99!', newPassword: 123 }, 400);
    await request(student, '/auth/password', 'PATCH', { currentPassword: 'ExamplePass99!', newPassword: 'ChangedPass99!' });
    await request(null, '/auth/login', 'POST', { email: student.email, password: 'ExamplePass99!' }, 401);
    await request(null, '/auth/login', 'POST', { email: student.email, password: 'ChangedPass99!' });
    await request(student, '/auth/profile', 'PATCH', { phoneNumber: '9999999999', skills: ['Python', 'SQL'], resumeUrl: 'https://example.test/resume', roleName: 'admin' });
    const profile = (await request(student, '/auth/me')).user;
    assert.equal(profile.role, 'student'); assert.deepEqual(profile.skills, ['Python', 'SQL']);
    await request(student, '/auth/profile', 'PATCH', { resumeUrl: 'javascript:alert(1)' }, 400);
    await request(admin, `/organizations/${org._id}`, 'PATCH', { status: 'active' }, 403);
    const features = (await request(superadmin, '/features')).features;
    const reportsFeature = features.find(feature => feature.key === 'reports');
    const analyticsFeature = features.find(feature => feature.key === 'analytics');
    await request(admin, `/organizations/${org._id}`, 'PATCH', { features: [reportsFeature._id] }, 403);
    await request(teacher, `/organizations/${org._id}`, 'PATCH', { features: [reportsFeature._id] }, 403);
    await request(superadmin, `/organizations/${org._id}`, 'PATCH', { features: ['missing-feature'] }, 400);
    await request(superadmin, `/organizations/${org._id}`, 'PATCH', { features: [reportsFeature._id] });
    assert.deepEqual((await request(superadmin, `/organizations/${org._id}`)).organization.features.map(feature => feature._id), [reportsFeature._id]);
    assert.equal((await request(superadmin, `/organizations/${otherOrg._id}`)).organization.features.length, 0);
    await request(superadmin, `/organizations/${org._id}`, 'PATCH', { status: 'suspended' });
    await request(student, '/auth/me', 'GET', undefined, 403);
    await request(null, '/auth/login', 'POST', { email: student.email, password: 'ChangedPass99!' }, 403);
    await request(superadmin, `/organizations/${org._id}`, 'PATCH', { status: 'active' });
    await Role.updateOne({ _id: roles.admin._id }, { $set: { permissions: [] } });
    await request(admin, '/users', 'POST', { name: 'Blocked', email: 'blocked@example.test', roleName: 'student' }, 403);
    await Role.updateOne({ _id: roles.admin._id }, { $set: { permissions: ['users:manage'] } });
    const created = await request(admin, '/users', 'POST', { name: 'New learner', email: 'new@example.test', roleName: 'student' }, 201);
    assert.ok(created.temporaryPassword.length >= 20);
    await request(admin, '/users', 'POST', { name: 'Duplicate', email: 'new@example.test', roleName: 'student' }, 409);
    const registration = await request(null, '/org-registrations', 'POST', { orgName: 'New College', orgEmail: 'onboard@example.test', address: 'Campus', phoneNumber: '1234567890' }, 201);
    const approval = await request(superadmin, `/org-registrations/${registration.registration._id}/approve`, 'POST', {});
    assert.ok(approval.temporaryPassword);
    assert.equal(approval.organization.credentialsSentAt, null);
    const retried = await request(superadmin, `/org-registrations/${registration.registration._id}/approve`, 'POST', {});
    assert.equal(retried.organization._id, approval.organization._id);
    assert.equal(await AcceptedOrganization.countDocuments({ registrationRequest: registration.registration._id }), 1);
    await request(null, '/auth/login', 'POST', { email: 'onboard@example.test', password: retried.temporaryPassword });

    const payload = { title: 'Exam', category: 'coding', instructions: 'Choose an answer', durationMinutes: 10, totalMarks: 1, passingMarks: 1, attemptsAllowed: 2, status: 'active', assignedSections: [String(section._id)], questions: [{ type: 'single-choice', text: 'Choose uppercase A', options: ['A', 'a'], correctAnswer: 'A', marks: 1 }], shuffleQuestions: true, shuffleOptions: true };
    await request(teacher, '/assessments', 'POST', { ...payload, questions: [null] }, 400);
    await request(teacher, '/assessments', 'POST', { ...payload, passingMarks: 'oops' }, 400);
    const { assessment } = await request(teacher, '/assessments', 'POST', payload, 201);
    const started = (await request(student, `/readiness/assessments/${assessment._id}/start`, 'POST')).attempt;
    await request(student, `/readiness/attempts/${started.ledgerId}/${started.id}/answers`, 'PATCH', { answers: ['A'] });
    await AssessmentLedger.updateOne({ _id: started.ledgerId, 'attempts._id': started.id }, { $set: { 'attempts.$.dueAt': new Date(Date.now() - 1000) } });
    const catalog = await request(student, '/readiness/assessments');
    assert.equal(catalog.attempts[0].status, 'graded'); assert.equal(catalog.attempts[0].score, 1);
    const scoped = await request(teacher, `/readiness/assessments/${assessment._id}/reviews`);
    assert.equal(scoped.attempts.length, 1);
    await request(outsider, `/readiness/assessments/${assessment._id}/start`, 'POST', {}, 404);

    const delayed = (await request(teacher, '/assessments', 'POST', { ...payload, title: 'Delayed results', showResultImmediately: false, allowAnswerReview: false }, 201)).assessment;
    const delayedAttempt = (await request(student, `/readiness/assessments/${delayed._id}/start`, 'POST')).attempt;
    const hidden = (await request(student, `/readiness/attempts/${delayedAttempt.ledgerId}/${delayedAttempt.id}/submit`, 'POST', { answers: ['A'] })).attempt;
    assert.equal(hidden.score, null); assert.deepEqual(hidden.questions, []);
    const studentReport = await request(student, '/readiness/me');
    assert.ok(!studentReport.evidence.some(row => row.title === 'Delayed results'));
    await request(teacher, `/assessments/${delayed._id}`, 'PATCH', { status: 'completed' });
    const released = (await request(student, '/readiness/assessments')).attempts.find(row => row.id === delayedAttempt.id);
    assert.equal(released.score, 1); assert.deepEqual(released.questions, []);

    const { work } = await request(teacher, '/work', 'POST', { title: 'Explain your solution', instructions: 'Provide your approach', kind: 'homework', status: 'published', assignedSections: [String(section._id)] }, 201);
    await request(outsider, `/work/${work._id}/submissions`, 'POST', { response: 'Spoof' }, 404);
    const submission = await request(student, `/work/${work._id}/submissions`, 'POST', { response: 'I used a stack' });
    await request(student, `/work/${work._id}/submissions`, 'POST', { response: 'I used a stack with linear time' });
    assert.equal((await request(teacher, `/work/${work._id}/submissions`)).submissions.length, 1);
    await request(teacher, `/work/${work._id}/submissions/${submission.submission._id}/review`, 'POST', { feedback: 'Explain the space complexity too.' });
    assert.equal((await request(student, '/community/work')).work.find(item => item._id === work._id).submission.status, 'reviewed');
    await request(student, `/work/${work._id}/submissions`, 'POST', { response: 'Changed' }, 409);

    const jobs = new Map();
    executor = createServer(async (req, res) => {
      assert.equal(req.headers['x-auth-token'], 'isolated-execution-token');
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'POST') {
        let raw = ''; for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw); assert.equal(body.enable_network, false);
        const token = `job-${jobs.size}`; jobs.set(token, { status: { id: 3, description: 'Accepted' }, stdout: body.expected_output });
        res.end(JSON.stringify({ token }));
      } else res.end(JSON.stringify(jobs.get(req.url.split('/').at(-1))));
    });
    await new Promise<void>(resolve => executor.listen(0, '127.0.0.1', resolve));
    process.env.CODEBOX_URL = `http://127.0.0.1:${executor.address().port}`;
    process.env.CODEBOX_TOKEN = 'isolated-execution-token';
    const coding = { problemId: 'sum-of-readings', languageId: 71, source: 'print(sum(values[1:]))', mode: 'submit', requestId: 'coding-regression-001' };
    const code = await request(student, '/coding/submissions', 'POST', coding, 201);
    const duplicateCode = await request(student, '/coding/submissions', 'POST', coding);
    assert.equal(duplicateCode.submission.id, code.submission.id); assert.equal(jobs.size, 3);
    await request(outsider, `/coding/submissions/${code.submission.id}`, 'GET', undefined, 404);
    const result = await request(student, `/coding/submissions/${code.submission.id}`);
    assert.equal(result.submission.status, 'Accepted'); assert.equal(result.submission.passed, 3);
    await request(student, `/coding/submissions/${code.submission.id}`);
    assert.equal(await ReadinessEvidence.countDocuments({ student: student._id, requestId: `coding-${code.submission.id}` }), 1);
    delete process.env.CODEBOX_TOKEN;
    await request(student, '/coding/submissions', 'POST', { ...coding, requestId: 'coding-unavailable-002' }, 503);
    if (process.env.PLAYWRIGHT_MODULE) {
      const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
      const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
      try {
        await AcceptedOrganization.collection.insertMany(Array.from({ length: 35 }, (_, index) => ({
          registrationRequest: new mongoose.Types.ObjectId(), orgName: `Directory Institution ${index}`, orgEmail: `directory-${index}@example.test`,
          address: 'Campus address', phoneNumber: '1234567890', status: 'active', features: [], acceptedBy: superadmin._id,
        })));
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
        await context.addInitScript(token => localStorage.setItem('accessToken', token), jwt.sign({ sub: String(superadmin._id) }, process.env.JWT_SECRET!));
        const page = await context.newPage();
        const browserErrors: string[] = []; const apiPaths: string[] = []; let failNextSave = false;
        page.on('pageerror', error => browserErrors.push(error.message));
        await context.route('**/api/**', async route => {
          const url = new URL(route.request().url()); apiPaths.push(url.pathname);
          if (failNextSave && route.request().method() === 'PATCH' && url.pathname === `/api/organizations/${org._id}`) {
            failNextSave = false;
            await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary save failure. Please retry.' }) }); return;
          }
          const response = await route.fetch({ url: base + url.pathname.replace(/^\/api/, '') + url.search });
          await route.fulfill({ response });
        });
        await page.goto('http://127.0.0.1:5178/super-admin/organizations');
        await page.getByRole('button', { name: /First College/ }).click();
        await page.getByRole('button', { name: 'Edit enabled features' }).click();
        await page.getByRole('checkbox', { name: 'Analytics', exact: true }).check();
        await page.getByRole('button', { name: 'Save features', exact: true }).click();
        await page.getByText('Enabled features saved.', { exact: true }).waitFor();
        assert.deepEqual((await AcceptedOrganization.findById(org._id)).features.map(String).sort(), [reportsFeature._id, analyticsFeature._id].sort());
        await page.reload();
        await page.getByRole('button', { name: /First College/ }).click();
        await page.getByRole('button', { name: 'Edit enabled features' }).click();
        assert.equal(await page.getByRole('checkbox', { name: 'Analytics', exact: true }).isChecked(), true);
        await page.getByRole('checkbox', { name: 'Analytics', exact: true }).uncheck();
        await page.getByRole('button', { name: 'Cancel changes', exact: true }).click();
        assert.equal(await page.getByRole('checkbox', { name: 'Analytics', exact: true }).isChecked(), true);
        await page.getByRole('checkbox', { name: 'Analytics', exact: true }).uncheck();
        failNextSave = true;
        await page.getByRole('button', { name: 'Save features', exact: true }).click();
        await page.getByText('Temporary save failure. Please retry.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('checkbox', { name: 'Analytics', exact: true }).isChecked(), false);
        assert.equal(await page.getByText('Enabled features saved.', { exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Save features', exact: true }).click();
        await page.getByText('Enabled features saved.', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Contact details', exact: true }).click();
        await page.getByLabel('Address', { exact: true }).fill('Updated campus address with a long line '.repeat(20));
        await page.getByRole('button', { name: 'Save details', exact: true }).click();
        await page.getByText('Organization details saved.', { exact: true }).waitFor();
        assert.match((await AcceptedOrganization.findById(org._id)).address, /^Updated campus/);
        await page.getByRole('button', { name: 'Overview', exact: true }).click();
        await page.getByRole('button', { name: 'Suspend organization', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm suspension', exact: true }).click();
        await page.getByText('Organization suspended.', { exact: true }).waitFor();
        await request(student, '/auth/me', 'GET', undefined, 403);
        await page.getByRole('button', { name: 'Activate organization', exact: true }).click();
        await page.getByText('Organization activated.', { exact: true }).waitFor();
        for (const width of [390, 1024, 1440, 1920]) {
          await page.setViewportSize({ width, height: 900 });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Organizations must fit at ${width}px`);
          if (width >= 1024) {
            const layout = await page.evaluate(() => {
              const directory = document.querySelector('[aria-label="Organization directory"]')!;
              const details = document.getElementById('organization-details')!;
              const content = document.querySelector('[aria-label="Organization information"]')!;
              return { directoryWidth: directory.clientWidth, detailsWidth: details.clientWidth, bottom: details.getBoundingClientRect().bottom, directoryScrolls: directory.scrollHeight > directory.clientHeight, detailsScrolls: content.scrollHeight > content.clientHeight };
            });
            assert.ok(layout.detailsWidth > layout.directoryWidth, 'Details must have more width than the directory');
            assert.ok(layout.bottom <= 910, 'Details panel must fit below the workspace header');
            assert.ok(layout.directoryScrolls && layout.detailsScrolls, 'Long directories and information must scroll within their own panels');
          }
          await page.screenshot({ path: `/tmp/placement-organizations-${width}.png`, fullPage: true });
        }
        assert.ok(!apiPaths.some(path => path.startsWith('/api/users') || path.startsWith('/api/roles')), 'Organization screens must not download unrelated user or role directories');
        assert.deepEqual(browserErrors, []);
        console.log('PASS: Chromium organization feature save/reload/cancel/failure/retry, contact persistence, suspension, compact directory, and bounded responsive panels.');
      } finally { await browser.close(); }
    }
    await User.collection.insertMany(Array.from({ length: 12000 }, (_, index) => ({
      organization: org._id, role: roles.student._id, roleName: 'student', status: 'active',
      name: `Scale Student ${String(index).padStart(5, '0')}`, email: `scale-${index}@example.test`,
    })));
    const startedAt = performance.now();
    const scaleReport = await request(admin, '/readiness/students?search=Scale%20Student&page=240');
    assert.equal(scaleReport.total, 12000); assert.equal(scaleReport.students.length, 50); assert.equal(scaleReport.pages, 240);
    const directory = await request(admin, '/users?limit=200');
    assert.equal(directory.users.length, 200); assert.ok(directory.nextCursor);
    const secondPage = await request(admin, `/users?limit=200&before=${directory.nextCursor}`);
    assert.ok(secondPage.users.every(user => !directory.users.some(first => first.id === user.id)));
    console.log(`MEASURED: 12,000 database records, one 50-student report plus two user pages in ${Math.round(performance.now() - startedAt)} ms. This validates data volume and paging, not simultaneous-session capacity.`);
    const directoryStartedAt = performance.now();
    const scopedReadiness = await request(admin, '/readiness/students?view=directory&search=Scale%20Student&readiness=Insufficient%20Evidence&page=240');
    assert.equal(scopedReadiness.counts['Insufficient Evidence'], 12000);
    assert.equal(scopedReadiness.total, 12000);
    assert.equal(scopedReadiness.page, 240);
    assert.equal(scopedReadiness.students.length, 50);
    console.log(`MEASURED: global readiness counts, filtering, and page 240 of 12,000 students in ${Math.round(performance.now() - directoryStartedAt)} ms on the isolated database.`);
    console.log('PASS: authentication, suspended organizations, RBAC, approval retry, assessment validation and expiry, homework submission and feedback, CodeBox contract and tenant isolation');
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    if (executor) await new Promise<void>(resolve => executor.close(() => resolve()));
    await mongoose.disconnect(); mongo.kill('SIGTERM');
    if (mongo.exitCode === null && mongo.signalCode === null) await new Promise(resolve => mongo.once('exit', resolve));
    await rm(folder, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
