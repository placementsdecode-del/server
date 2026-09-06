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
    const peers = await request(alice, '/community/section');
    assert.equal(peers.section._id, section.id); assert.equal(peers.classmates.length, 2); assert.ok(peers.classmates.every(peer => !peer.email && !peer.phoneNumber));
    assert.equal((await request(unrelated, '/community/section')).section, null);
    await request(teacher, '/groups', 'POST', { name: 'Invalid', students: [unrelated.toString()] }, 403);
    await request(admin, '/groups', 'POST', { name: 'Cross org', students: [outsider.toString()] }, 403);
    const { group } = await request(admin, '/groups', 'POST', { name: 'Coding peers', description: 'Practice together', students: [alice.toString(), bob.toString()] }, 201);
    assert.equal((await request(alice, '/groups')).groups.length, 0);
    assert.equal((await request(alice, '/groups/invitations')).invitations.length, 1);
    let inbox = await request(alice, '/community/notifications'); const inviteId = inbox.notifications[0]._id;
    assert.equal(inbox.unreadCount, 1);
    await request(bob, `/community/notifications/${inviteId}`, 'PATCH', { read: true }, 404);
    await request(alice, `/community/notifications/${inviteId}`, 'PATCH', { read: true });
    assert.equal((await request(alice, '/groups')).groups.length, 0);
    await request(alice, `/community/notifications/${inviteId}`, 'DELETE');
    assert.equal((await request(alice, '/community/notifications')).notifications.length, 0);
    assert.equal((await request(alice, '/groups/invitations')).invitations.length, 1);
    await request(alice, `/groups/${group._id}/invitations/me`, 'PATCH', { status: 'accepted' });
    const joined = (await request(alice, '/groups')).groups[0]; assert.equal(joined.participants.length, 1); assert.equal(joined.participants[0].student.name, 'Alice');
    await request(bob, `/groups/${group._id}/invitations/me`, 'PATCH', { status: 'declined' });
    assert.equal((await request(bob, '/groups')).groups.length, 0);
    await request(bob, `/groups/${group._id}/invitations/me`, 'PATCH', { status: 'accepted' }, 409);
    await request(outsider, `/groups/${group._id}/invitations/me`, 'PATCH', { status: 'accepted' }, 409);
    await request(admin, `/groups/${group._id}/invitations`, 'POST', { students: [alice.toString()] });
    assert.equal((await request(admin, '/groups')).groups[0].participants.length, 2);
    const { work } = await request(teacher, '/work', 'POST', { title: 'Practice arrays', instructions: 'Solve three array problems.', kind: 'task', status: 'draft', assignedSections: [section.id] }, 201);
    assert.equal((await request(alice, '/community/notifications')).notifications.length, 0);
    await request(teacher, `/work/${work._id}/publish`, 'POST');
    await request(teacher, `/work/${work._id}/publish`, 'POST');
    const polls = await Promise.all(Array.from({ length: 3 }, () => request(alice, '/community/notifications')));
    assert.ok(polls.every(result => result.notifications.length === 1));
    const workNotice = polls[0].notifications[0];
    await request(alice, '/community/notifications/read-all', 'PATCH');
    assert.equal((await request(alice, '/community/notifications')).unreadCount, 0);
    await request(alice, `/community/notifications/${workNotice._id}`, 'PATCH', { read: false });
    assert.equal((await request(alice, '/community/notifications')).unreadCount, 1);
    assert.equal((await request(alice, '/community/work')).work[0].instructions, 'Solve three array problems.');
    assert.equal((await request(outsider, '/community/work')).work.length, 0);
    const payload = { title: 'Aptitude', category: 'aptitude', instructions: 'Read each question.', durationMinutes: 10, totalMarks: 1, passingMarks: 1, status: 'draft', assignedSections: [section.id], questions: [{ type: 'single-choice', text: '1+1?', options: ['2', '3'], correctAnswer: '2', marks: 1 }] };
    const { assessment } = await request(teacher, '/assessments', 'POST', payload, 201);
    assert.equal((await request(alice, '/community/notifications')).notifications.length, 1);
    await request(teacher, `/assessments/${assessment._id}`, 'PATCH', { status: 'active', organization: otherOrg.toString() });
    inbox = await request(alice, '/community/notifications'); assert.equal(inbox.notifications.length, 2);
    const assessmentView = (await request(alice, '/community/work')).work.find(item => item.kind === 'assessment');
    assert.ok(assessmentView); assert.equal(assessmentView.questions, undefined);
    await request(admin, '/work', 'POST', { title: 'Wrong audience', instructions: 'No', kind: 'task', assignedSections: [otherSection.id] }, 403);
    // Cohort membership, conversations and student practice stay connected and scoped.
    const extra = await Section.create({ organization: org, name: 'Discussion cohort', code: 'GD', department: 'All', batch: '2026', academicYear: '2026-27', assignedTeachers: [teacher] });
    await request(teacher, `/sections/${extra.id}/members/${alice}`, 'POST');
    assert.equal((await request(alice, '/community/section')).sections.length, 2);
    assert.equal(String((await User.findById(alice)).section), section.id);
    await request(admin, `/sections/${extra.id}`, 'PATCH', { assignedTeachers: [outsider.toString()] }, 400);
    await request(admin, `/sections/${extra.id}`, 'PATCH', { assignedTeachers: [teacher.toString()] });
    await request(alice, `/groups/${group._id}/messages`, 'POST', { text: 'How do stacks work?' }, 201);
    await request(bob, `/groups/${group._id}/messages`, 'GET', undefined, 403);
    await request(outsider, `/groups/${group._id}/messages`, 'GET', undefined, 404);
    assert.equal((await request(admin, `/groups/${group._id}/messages`)).messages[0].text, 'How do stacks work?');
    await request(admin, `/groups/${group._id}/coordinators`, 'PATCH', { coordinators: [teacher.toString()] });
    assert.ok((await request(teacher, '/groups')).groups.some(g => g._id === group._id));
    await request(teacher, `/groups/${group._id}/messages`, 'POST', { text: 'A stack is last in, first out.' }, 201);
    assert.equal((await request(alice, '/groups')).groups.find(g => g._id === group._id).unreadCount, 1);
    await request(alice, `/groups/${group._id}/messages`);
    assert.equal((await request(alice, '/groups')).groups.find(g => g._id === group._id).unreadCount, 0);
    const { group: practiceRoom } = await request(alice, '/groups', 'POST', { name: 'DSA practice', mode: 'DSA Hackathon', description: 'Solve arrays', students: [bob.toString()] }, 201);
    assert.equal(practiceRoom.kind, 'practice');
    await request(admin, `/groups/${practiceRoom._id}/messages`, 'GET', undefined, 403);
    await request(bob, `/groups/${practiceRoom._id}/invitations/me`, 'PATCH', { status: 'accepted' });
    await request(bob, `/groups/${practiceRoom._id}/messages`, 'POST', { text: 'My solution' }, 201);
    assert.ok(!(await request(teacher, '/groups')).groups.some(g => g._id === practiceRoom._id));
    const groupAssessment = (await request(teacher, '/assessments', 'POST', { ...payload, title: 'Group assessment', assignedSections: [], assignedGroups: [group._id], status: 'active' }, 201)).assessment;
    assert.ok((await request(alice, '/readiness/assessments')).assessments.some(a => a._id === groupAssessment._id));
    assert.ok(!(await request(bob, '/readiness/assessments')).assessments.some(a => a._id === groupAssessment._id));
    const importResult = await request(teacher, '/users/bulk-students', 'POST', { students: [{ name: 'Imported student', email: 'imported@example.test', section: extra.id }, { name: 'Duplicate', email: 'test2@example.test', section: extra.id }] });
    assert.equal(importResult.results[0].status, 'created'); assert.ok(importResult.results[0].temporaryPassword);
    assert.equal(importResult.results[1].status, 'failed');
    await request(alice, '/users/bulk-students', 'POST', { students: [] }, 403);
    await request(teacher, `/sections/${extra.id}/members/${alice}`, 'DELETE');
    assert.equal((await request(alice, '/community/section')).sections.length, 1);
    if (process.env.PLAYWRIGHT_MODULE) {
      const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
      const browser = await chromium.launch({ executablePath: '/snap/bin/chromium', headless: true, args: ['--no-sandbox'] });
      try {
        const errors: string[] = [];
        async function openPage(user, path) {
          const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
          await context.addInitScript(token => localStorage.setItem('accessToken', token), jwt.sign({ sub: user.toString() }, process.env.JWT_SECRET!));
          const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
          await page.route('**/api/**', async route => {
            const url = new URL(route.request().url());
            const response = await route.fetch({ url: base + url.pathname.replace(/^\/api/, '') + url.search });
            await route.fulfill({ response });
          });
          await page.goto('http://127.0.0.1:5178' + path); return page;
        }
        const manager = await openPage(admin, '/admin/cohorts');
        await manager.getByRole('button', { name: /Section A.*2 participants/ }).click();
        await manager.getByRole('checkbox', { name: 'Coordinator', exact: true }).waitFor();
        await manager.getByRole('checkbox', { name: 'Admin', exact: true }).click();
        await manager.waitForFunction(() => [...document.querySelectorAll('label')].some(label => label.textContent?.trim() === 'Admin' && label.querySelector('input')?.checked));
        await manager.getByRole('button', { name: /Alice R2/ }).click();
        await manager.getByText('Student Detail', { exact: true }).waitFor();
        await manager.getByRole('button', { name: 'Students', exact: true }).click();
        await manager.getByText('Bulk upload students', { exact: false }).first().click();
        await manager.getByLabel('Student CSV file').setInputFiles({ name: 'students.csv', mimeType: 'text/csv', buffer: Buffer.from('name,email\nBrowser Import,browser-import@example.test\n') });
        await manager.getByLabel('Import cohort').selectOption(section.id);
        await manager.getByRole('button', { name: 'Import 1 students', exact: true }).click();
        await manager.getByText(/browser-import@example.test: Created · temporary password:/).waitFor();
        const student = await openPage(alice, '/student');
        await student.getByRole('heading', { name: /Your learning overview/ }).waitFor();
        await student.getByRole('button', { name: 'My Groups', exact: true }).click();
        await student.getByRole('button', { name: /Coding peers.*unread/ }).click();
        await student.getByLabel('Message', { exact: true }).fill('Browser conversation works');
        await student.getByRole('button', { name: 'Send message', exact: true }).click();
        await student.getByText('Browser conversation works', { exact: true }).waitFor();
        await student.getByRole('button', { name: 'Assessments', exact: true }).first().click();
        await student.getByRole('button', { name: /^Aptitude aptitude/ }).click();
        await student.getByRole('button', { name: 'Start assessment', exact: true }).click();
        await student.getByRole('radio', { name: '2', exact: true }).check();
        await student.getByRole('button', { name: 'Submit assessment', exact: true }).click();
        await student.getByText('Score 1/1', { exact: true }).waitFor();
        const teacherPage = await openPage(teacher, '/teacher/assessments');
        await teacherPage.getByRole('button', { name: 'Aptitude', exact: true }).click();
        await teacherPage.getByRole('cell', { name: 'Pass', exact: true }).waitFor();
        await teacherPage.getByRole('cell', { name: 'Not started', exact: true }).waitFor();
        await teacherPage.getByRole('button', { name: 'View answers', exact: true }).click();
        await teacherPage.getByText('Expected answer: 2', { exact: true }).waitFor();
        await teacherPage.screenshot({ path: '/tmp/placement-assessment-review.png', fullPage: true });
        await student.getByRole('button', { name: 'Self-Assessment', exact: true }).click();
        await student.getByRole('button', { name: 'Create practice room', exact: true }).click();
        await student.getByLabel('Title', { exact: true }).fill('Browser mock interview');
        await student.getByLabel('Questions, topics, or challenge rules').fill('Explain your latest project');
        await student.getByRole('button', { name: 'Create and invite', exact: true }).click();
        await student.getByRole('button', { name: /Browser mock interview/ }).waitFor();
        await student.reload();
        await student.getByRole('button', { name: /Browser mock interview/ }).waitFor();
        await student.setViewportSize({ width: 390, height: 844 });
        await student.screenshot({ path: '/tmp/placement-practice-mobile.png', fullPage: true });
        assert.ok(await student.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        assert.deepEqual(errors, []);
        console.log('PASS: Chromium: cohort cards and participants, student overview, chat, assessment submit, teacher pass/fail and answers, persistent practice, mobile layout.');
      } finally { await browser.close(); }
    }
    console.log('PASS: real MongoDB + HTTP: section privacy, consent, read/unread/delete, duplicate delivery, draft/publish, ownership, tenant boundaries, and answer redaction.');
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await mongoose.disconnect();
    mongo.kill('SIGTERM'); if (mongo.exitCode === null) await new Promise(resolve => mongo.once('exit', resolve));
    await rm(folder, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
