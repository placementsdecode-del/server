import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import User from '../src/models/User';
import AcceptedOrganization from '../src/models/AcceptedOrganization';
import { ensureOrganizationRoles } from '../src/services/rbac.service';

async function main() {
  assert.ok(process.env.CODEBOX_URL && process.env.CODEBOX_TOKEN, 'Configure a live CodeBox API and worker before running this suite');
  process.env.JWT_SECRET = 'isolated-live-coding-integration-secret';
  const folder = await mkdtemp(join(tmpdir(), 'placement-live-coding-'));
  const mongo = spawn('/usr/bin/mongod', ['--dbpath', folder, '--bind_ip', '127.0.0.1', '--port', '27965', '--quiet'], { stdio: 'ignore' });
  let server;
  try {
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(resolve, 1500); mongo.once('exit', code => { clearTimeout(timer); reject(new Error(`Database exited ${code}`)); }); mongo.once('error', reject); });
    await mongoose.connect('mongodb://127.0.0.1:27965/live_coding_test', { serverSelectionTimeoutMS: 10000 });
    const organization = await AcceptedOrganization.create({ registrationRequest: new mongoose.Types.ObjectId(), orgName: 'Code Test', orgEmail: 'live-code@example.test', phoneNumber: '1234567890', address: 'Campus', acceptedBy: new mongoose.Types.ObjectId() });
    const roles = await ensureOrganizationRoles(organization._id);
    const student = await User.create({ organization: organization._id, name: 'Coder', email: 'live-coder@example.test', role: roles.student._id, roleName: 'student', password: 'ExamplePass99!' });
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/coding`;
    const token = jwt.sign({ sub: student.id }, process.env.JWT_SECRET!);
    async function request(path: string, body?) {
      const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data;
    }
    const cases: [string, number, string, string][] = [
      ['python', 71, 'import sys\nvalues=list(map(int,sys.stdin.read().split()))\nprint(sum(values[1:]))\n', 'Accepted'],
      ['javascript', 63, "const fs = require('fs'); const values = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number); console.log(values.slice(1).reduce((a,b)=>a+b,0));", 'Accepted'],
      ['typescript', 74, "const fs = require('fs'); const values: number[] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number); console.log(values.slice(1).reduce((a,b)=>a+b,0));", 'Accepted'],
      ['cpp', 54, '#include <iostream>\nusing namespace std; int main() { int n; cin >> n; long long sum=0, value; while(n--) {cin >> value; sum+=value;} cout << sum << endl; }', 'Accepted'],
      ['java', 62, 'import java.util.*; public class Main { public static void main(String[] args) { Scanner input=new Scanner(System.in); int n=input.nextInt(); long sum=0; for(int i=0;i<n;i++) sum+=input.nextLong(); System.out.println(sum); } }', 'Accepted'],
      ['wrong', 71, 'print(999)\n', 'Wrong Answer'],
    ];
    for (const [id, languageId, source, expected] of cases) {
      const created = await request('/submissions', { problemId: 'sum-of-readings', languageId, source, mode: 'submit', requestId: `live-code-${id}-001` });
      let result = created.submission;
      const deadline = Date.now() + 90000;
      while (result.active && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        result = (await request(`/submissions/${result.id}`)).submission;
      }
      assert.equal(result.active, false, 'Execution must finish before the test deadline');
      assert.equal(result.status, expected, JSON.stringify(result));
      assert.equal(result.passed, id === 'wrong' ? 0 : 3);
      console.log(`PASS: live ${id} submission returned ${result.status}`);
    }
    console.log('PASS: Placement Decode API → CodeBox API → Redis worker → Docker language sandboxes. Python, JavaScript, TypeScript, C++, Java, and incorrect submissions return verified results.');
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await mongoose.disconnect(); mongo.kill('SIGTERM');
    if (mongo.exitCode === null && mongo.signalCode === null) await new Promise(resolve => mongo.once('exit', resolve));
    await rm(folder, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
