import mongoose from 'mongoose';
const attempt = new mongoose.Schema({
  startedAt: Date, dueAt: Date, submittedAt: Date, gradedAt: Date,
  status: { type: String, enum: ['in-progress', 'submitted', 'graded'], default: 'in-progress' },
  title: String, skill: String, difficulty: String, totalMarks: Number, passingMarks: Number, negativeMarking: Boolean,
  questions: [mongoose.Schema.Types.Mixed], answers: [mongoose.Schema.Types.Mixed], marks: [Number],
  score: Number, feedback: String, rubric: String, gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});
const schema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, required: true }, student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true }, attempts: [attempt],
}, { timestamps: true });
schema.index({ student: 1, assessment: 1 }, { unique: true });
export default mongoose.model('AssessmentLedger', schema);
