import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, required: true },
  student: { type: mongoose.Schema.Types.ObjectId, required: true },
  requestId: { type: String, required: true },
  problemId: { type: String, required: true },
  languageId: Number,
  source: { type: String, required: true, maxlength: 30000 },
  mode: { type: String, enum: ['run', 'submit'], required: true },
  tokens: [String],
  active: { type: Boolean, default: true },
  status: { type: String, default: 'Queued' },
  passed: { type: Number, default: 0 },
  total: Number,
  output: { type: String, default: '' },
}, { timestamps: true });
schema.index({ student: 1, requestId: 1 }, { unique: true });
schema.index({ student: 1, active: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ organization: 1, student: 1, createdAt: -1 });
export default mongoose.model('CodingSubmission', schema);
