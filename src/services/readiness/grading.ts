export const automaticTypes = new Set(['single-choice', 'multiple-choice', 'true-false', 'numerical']);
export function validateAnswers(answers: unknown, count: number) {
  return Array.isArray(answers) && answers.length <= count && answers.every(answer => answer === null || typeof answer === 'string' && answer.length <= 10000 || Array.isArray(answer) && answer.length <= 100 && answer.every(value => typeof value === 'string' && value.length <= 1000));
}
export function autoMarks(questions, answers, negativeMarking: boolean) {
  return questions.map((question, index) => {
    if (!automaticTypes.has(question.type)) return null;
    const answer = answers[index];
    if (answer === null || answer === undefined || answer === '' || Array.isArray(answer) && !answer.length) return 0;
    if (question.correctAnswer === null || question.correctAnswer === undefined) return 0;
    let correct = false;
    if (question.type === 'multiple-choice') {
      correct = Array.isArray(answer) && Array.isArray(question.correctAnswer) && [...new Set(answer)].sort().join('\u0000') === [...new Set(question.correctAnswer)].sort().join('\u0000');
    } else if (question.type === 'numerical') {
      correct = typeof answer === 'string' && answer.trim() !== '' && Number.isFinite(Number(answer)) && Number(answer) === Number(question.correctAnswer);
    } else correct = typeof answer === 'string' && String(answer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();
    return correct ? Number(question.marks) : negativeMarking ? -Number(question.negativeMarks || 0) : 0;
  });
}
