import mongoose, { PipelineStage } from 'mongoose';
import User from '../models/User';
import Assessment from '../models/Assessment';
import Section from '../models/Section';
import AssessmentLedger from '../models/AssessmentLedger';
import asyncHandler from '../utils/asyncHandler';
import ApiError from '../utils/apiError';

export const leaderboard = asyncHandler(async (req, res) => {
  const organization = req.user.organization;
  const cohort = req.query.cohort;
  if (cohort !== undefined && (typeof cohort !== 'string' || !mongoose.isValidObjectId(cohort))) throw new ApiError(400, 'Choose a valid cohort');
  const studentFilter: Record<string, unknown> = { organization, roleName: 'student', status: 'active' };
  if (cohort) {
    const id = new mongoose.Types.ObjectId(String(cohort));
    studentFilter.$or = [{ section: id }, { cohorts: id }];
  }
  const pipeline: PipelineStage[] = [
    { $match: { organization, 'attempts.status': 'graded' } },
    { $unwind: '$attempts' },
    { $match: { 'attempts.status': 'graded', 'attempts.totalMarks': { $gt: 0 }, 'attempts.score': { $ne: null } } },
    { $lookup: { from: Assessment.collection.name, localField: 'assessment', foreignField: '_id', as: 'assessmentInfo' } },
    { $match: { $or: [{ 'attempts.showResultImmediately': { $ne: false } }, { 'assessmentInfo.status': 'completed' }] } },
    { $group: { _id: { student: '$student', assessment: '$assessment' }, percentage: { $max: { $multiply: [{ $divide: ['$attempts.score', '$attempts.totalMarks'] }, 100] } } } },
    { $group: { _id: '$_id.student', assessments: { $sum: 1 }, score: { $avg: '$percentage' } } },
    { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id', pipeline: [{ $match: studentFilter }], as: 'student' } },
    { $unwind: '$student' },
    { $project: { _id: 0, id: '$_id', name: '$student.name', department: { $ifNull: ['$student.department', ''] }, batch: { $ifNull: ['$student.batch', ''] }, assessments: 1, score: { $round: ['$score', 1] },
      cohortIds: { $map: { input: { $setUnion: [{ $ifNull: ['$student.cohorts', []] }, { $cond: ['$student.section', ['$student.section'], []] }] }, as: 'id', in: { $toString: '$$id' } } } } },
    { $sort: { score: -1, assessments: -1, name: 1, id: 1 } },
    { $limit: 50 },
  ];
  const [sections, rows] = await Promise.all([
    Section.find({ organization, status: 'active' }).select('name code').lean(),
    AssessmentLedger.aggregate(pipeline).collation({ locale: 'en', strength: 2 }),
  ]);
  res.json({ sections, rows });
});
