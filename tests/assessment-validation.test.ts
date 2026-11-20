import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAssessmentPayload } from '../src/controllers/assessment.controller';

const assessment = {
  title: 'Assessment', category: 'aptitude', instructions: 'Choose an answer',
  durationMinutes: 10, totalMarks: 1, passingMarks: 1,
  questions: [{ type: 'single-choice', text: 'Choose A', options: ['A', 'B'], correctAnswer: 'A', marks: 1 }],
};

test('Malformed questions produce validation errors without throwing', () => {
  for (const questions of [[null], [42], [{ type: 'multiple-choice', text: 'Choose A', marks: 1, options: {}, correctAnswer: ['A'] }]]) {
    assert.ok(validateAssessmentPayload({ ...assessment, questions }).length > 0);
  }
});

test('Invalid numeric thresholds and duplicate options are rejected', () => {
  assert.ok(validateAssessmentPayload({ ...assessment, passingMarks: 'invalid' }).length > 0);
  assert.ok(validateAssessmentPayload({ ...assessment, totalMarks: Infinity }).length > 0);
  assert.ok(validateAssessmentPayload({ ...assessment, questions: [{ ...assessment.questions[0], options: ['A', 'A'] }] }).length > 0);
});

test('A valid numerical answer of zero remains valid', () => {
  assert.deepEqual(validateAssessmentPayload({ ...assessment, questions: [{ type: 'numerical', text: '1 - 1?', correctAnswer: 0, marks: 1 }] }), []);
});
