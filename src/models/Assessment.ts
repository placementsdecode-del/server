import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["single-choice", "multiple-choice", "true-false", "short-answer", "long-answer", "coding", "file-upload", "numerical"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      default: [],
    },
    correctAnswer: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    explanation: {
      type: String,
      trim: true,
      default: "",
    },
    marks: {
      type: Number,
      min: 1,
      required: true,
    },
    negativeMarks: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: true }
);

const assessmentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcceptedOrganization",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "intermediate",
    },
    instructions: {
      type: String,
      required: true,
      trim: true,
    },
    durationMinutes: {
      type: Number,
      min: 1,
      required: true,
    },
    totalMarks: {
      type: Number,
      min: 1,
      required: true,
    },
    passingMarks: {
      type: Number,
      min: 0,
      required: true,
    },
    attemptsAllowed: {
      type: Number,
      min: 1,
      default: 1,
    },
    negativeMarking: {
      type: Boolean,
      default: false,
    },
    shuffleQuestions: {
      type: Boolean,
      default: false,
    },
    shuffleOptions: {
      type: Boolean,
      default: false,
    },
    showResultImmediately: {
      type: Boolean,
      default: true,
    },
    allowAnswerReview: {
      type: Boolean,
      default: true,
    },
    assignedSections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Section",
      },
    ],
    assignedTeachers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    questions: {
      type: [questionSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "active", "completed", "archived"],
      default: "draft",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Assessment", assessmentSchema);
