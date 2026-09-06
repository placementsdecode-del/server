# Cohorts, assessments, and peer practice

- Students use Dashboard for available assessments, unread group messages, notifications, and recent learning activity. Progress holds readiness and the organization/cohort leaderboard.
- Cohorts → cohort card → participant card opens a participant's profile. Faculty see recorded readiness; classmates see only basic profile information.
- Admins assign faculty inside a cohort's Coordinators panel. Students can retain a primary class (`section`) and additional learning memberships (`cohorts`). The new `/api/sections/:sectionId/members/:studentId` POST/DELETE endpoints add/remove a cohort without moving other memberships. Legacy primary-class move endpoints remain supported.
- Assessments → Create assessment supports arbitrary subjects, cohort or group audiences, question construction, duration, pass percentage, and grading rubric. Publish snapshots the current audience. Groups include accepted students only; practice rooms cannot receive official assessments.
- Assessments → assessment card → student row shows all attempts, not-started students, elapsed time, objective correct counts, marks, and pass/fail. Written/coding answers await rubric-based faculty grading. Automatic grades remain visible in this list.
- Groups → group card opens persistent chat. Only accepted members, owners, assigned coordinators, and organization admins may access official groups. Messages refresh every five seconds; the conversation shows the latest 100 messages. Reading a conversation updates its unread count.
- Self-Assessment creates persistent student-owned practice rooms for written practice, group discussions, mock interviews, and DSA hackathons. Shared prompts/rules and text responses live in the conversation. Peers receive invitations. Faculty cannot access these rooms or include them in official assessment scores.
- Students → Bulk upload accepts a CSV of up to 100 rows. Download the header template, choose a cohort, preview, and import. Each row reports success or failure; successful accounts receive a temporary password. Failed rows can be retried without resubmitting successful rows. Faculty may import into their assigned cohorts only.
- Leaderboards use each student's best graded attempt per assessment, then average those percentages. Ties use assessment count and name. Cohort filters use primary and additional memberships. This is an activity ranking across potentially different assessment sets, not a standardized exam comparison.

## Verification

Run from `server`:

```sh
npm run check
node --import tsx tests/readiness-scoring.test.ts
node --import tsx tests/section-membership.test.ts
node --import tsx tests/community.integration.ts
node --import tsx tests/readiness.integration.ts
```

Integration suites start their own temporary MongoDB on port 27963 and must run sequentially. Optional Chromium coverage uses `PLAYWRIGHT_MODULE` pointing to an installed `playwright-core`, `/snap/bin/chromium`, and the client development server at port 5178. Tests use isolated database records and intercept browser API requests to the test server.
