import mongoose from "mongoose";
const schema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  instructions: { type: String, required: true, trim: true, maxlength: 10000 },
  kind: { type: String, enum: ["task", "homework", "activity", "announcement"], required: true },
  assignedSections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Section" }],
  status: { type: String, enum: ["draft", "published"], default: "draft" },
  publishedAt: { type: Date, default: null },
  notificationRecipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });
schema.index({ organization: 1, notificationRecipients: 1 });
export default mongoose.model("AssignedWork", schema);
