import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, required: true },
  work: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignedWork', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  response: { type: String, required: true, maxlength: 10000 },
  status: { type: String, enum: ['submitted', 'reviewed'], default: 'submitted' },
  feedback: { type: String, default: '', maxlength: 5000 },
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
schema.index({ work: 1, student: 1 }, { unique: true });
schema.index({ organization: 1, student: 1 });
export default mongoose.model('WorkSubmission', schema);
