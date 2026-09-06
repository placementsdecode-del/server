import mongoose from "mongoose";
const groupSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: "AcceptedOrganization", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: "", trim: true, maxlength: 2000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  participants: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    invitedAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
  }],
}, { timestamps: true });
groupSchema.index({ organization: 1, "participants.student": 1 });
export default mongoose.model("Group", groupSchema);
