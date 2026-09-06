import mongoose from 'mongoose';
const objectId = mongoose.Schema.Types.ObjectId;
const skill = new mongoose.Schema({ key: String, label: String, weight: Number, minimum: Number, mandatory: Boolean }, { _id: false });
const policySchema = new mongoose.Schema({
  organization: { type: objectId, required: true }, key: { type: String, required: true }, label: String, version: Number,
  skills: [skill], minSamples: Number, freshnessDays: Number, halfLifeDays: Number, readyScore: Number, almostScore: Number,
  minCgpa: { type: Number, default: null }, maxBacklogs: { type: Number, default: null }, graduationYears: [Number],
  createdBy: objectId,
}, { timestamps: true });
policySchema.index({ organization: 1, key: 1, version: 1 }, { unique: true });
export const ReadinessPolicy = mongoose.model('ReadinessPolicy', policySchema);
const evidenceSchema = new mongoose.Schema({
  organization: { type: objectId, required: true }, student: { type: objectId, ref: 'User', required: true },
  requestId: { type: String, required: true }, reference: { type: String, required: true }, skill: String, title: String,
  kind: { type: String, enum: ['problem', 'evaluation'], required: true },
  source: { type: String, enum: ['self-reported', 'instructor-rated'], required: true },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
  score: Number, maxScore: Number, solved: Boolean, submissions: Number, testCasesPassed: Number, testCasesTotal: Number,
  rubric: String, feedback: String, createdBy: objectId,
}, { timestamps: true });
evidenceSchema.index({ student: 1, requestId: 1 }, { unique: true });
evidenceSchema.index({ organization: 1, student: 1, createdAt: -1 });
export const ReadinessEvidence = mongoose.model('ReadinessEvidence', evidenceSchema);
const learningSchema = new mongoose.Schema({
  organization: { type: objectId, required: true }, student: { type: objectId, required: true }, bucket: Number,
  seconds: { type: Number, min: 0, max: 30 }, context: String,
}, { timestamps: true });
learningSchema.index({ student: 1, bucket: 1 }, { unique: true });
learningSchema.index({ organization: 1, student: 1, createdAt: 1 });
export const LearningPulse = mongoose.model('LearningPulse', learningSchema);
const academicSchema = new mongoose.Schema({ organization: objectId, student: { type: objectId, ref: 'User' }, cgpa: Number, backlogs: Number, graduationYear: Number, reason: String, recordedBy: objectId }, { timestamps: true });
academicSchema.index({ organization: 1, student: 1, createdAt: -1 });
export const AcademicRecord = mongoose.model('AcademicRecord', academicSchema);
const decisionSchema = new mongoose.Schema({
  organization: objectId, student: { type: objectId, ref: 'User' }, policy: { type: objectId, ref: 'ReadinessPolicy' },
  decision: { type: String, enum: ['Shortlisted', 'Hold', 'Needs Training', 'Not Eligible'] }, reason: String,
  recordedBy: { type: objectId, ref: 'User' }, snapshot: mongoose.Schema.Types.Mixed,
}, { timestamps: true });
export const ShortlistDecision = mongoose.model('ShortlistDecision', decisionSchema);
const consentSchema = new mongoose.Schema({ organization: objectId, student: objectId, granted: Boolean }, { timestamps: true });
export const ReadinessConsent = mongoose.model('ReadinessConsent', consentSchema);
