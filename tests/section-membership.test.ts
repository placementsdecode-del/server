import assert from "node:assert/strict";
import { test, mock, afterEach } from "node:test";
import Section from "../src/models/Section";
import User from "../src/models/User";
import { assignStudentToSection, removeStudentFromSection, createSection } from "../src/controllers/section.controller";

afterEach(() => mock.restoreAll());
const section = { _id: "section-a", organization: "org-a", status: "active" };
function request(overrides = {}) {
  return { user: { roleName: "admin", organization: "org-a" }, params: { sectionId: "section-a", studentId: "student-a" }, body: {}, ...overrides };
}
async function call(handler, req) {
  let body; let error;
  await handler(req, { json: (value) => { body = value; } }, (value) => { error = value; });
  return { body, error };
}
test("assigns a student and persists the section", async () => {
  let saved = false;
  const student = { roleName: "student", organization: "org-a", section: null, save: async () => { saved = true; } };
  mock.method(Section, "findById", async () => section);
  mock.method(User, "findById", async () => student);
  const result = await call(assignStudentToSection, request());
  assert.equal(result.error, undefined); assert.equal(student.section, "section-a"); assert.ok(saved);
  assert.deepEqual(result.body, { message: "Student assigned to section" });
});
test("rejects cross-organization assignment", async () => {
  mock.method(Section, "findById", async () => section);
  mock.method(User, "findById", async () => ({ roleName: "student", organization: "org-b" }));
  assert.equal((await call(assignStudentToSection, request())).error.statusCode, 400);
});
test("rejects inactive sections", async () => {
  mock.method(Section, "findById", async () => ({ ...section, status: "inactive" }));
  mock.method(User, "findById", async () => ({ roleName: "student", organization: "org-a" }));
  assert.equal((await call(assignStudentToSection, request())).error.statusCode, 400);
});
test("removes membership using the organization and current section", async () => {
  mock.method(Section, "findById", async () => section);
  mock.method(User, "findOneAndUpdate", async (filter, update) => {
    assert.deepEqual(filter, { _id: "student-a", roleName: "student", organization: "org-a", section: "section-a" });
    assert.deepEqual(update, { $set: { section: null } }); return {};
  });
  assert.equal((await call(removeStudentFromSection, request())).error, undefined);
});
test("stale removals return a conflict", async () => {
  mock.method(Section, "findById", async () => section);
  mock.method(User, "findOneAndUpdate", async () => null);
  assert.equal((await call(removeStudentFromSection, request())).error.statusCode, 409);
});
test("rejects removal from another organization", async () => {
  mock.method(Section, "findById", async () => section);
  assert.equal((await call(removeStudentFromSection, request({ user: { roleName: "admin", organization: "org-b" } }))).error.statusCode, 403);
});
test("requires academic year when creating a section", async () => {
  assert.equal((await call(createSection, request({ body: { name: "A", code: "A", department: "CSE", batch: "2026" } }))).error.statusCode, 400);
});
test("coordinators cannot assign students to unassigned sections", async () => {
  mock.method(Section, "findById", async () => ({ ...section, assignedTeachers: ["another-teacher"] }));
  const result = await call(assignStudentToSection, request({ user: { roleName: "teacher", organization: "org-a", _id: "teacher-a" } }));
  assert.equal(result.error.statusCode, 403);
});
test("coordinators cannot remove students from unassigned sections", async () => {
  mock.method(Section, "findById", async () => ({ ...section, assignedTeachers: [] }));
  const result = await call(removeStudentFromSection, request({ user: { roleName: "teacher", organization: "org-a", _id: "teacher-a" } }));
  assert.equal(result.error.statusCode, 403);
});
