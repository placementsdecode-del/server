import mongoose from "mongoose";
const schema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  eventKey: { type: String, required: true },
  kind: { type: String, enum: ["invitation", "assessment", "work"], required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ recipient: 1, eventKey: 1 }, { unique: true });
schema.index({ recipient: 1, deletedAt: 1, createdAt: -1 });
export default mongoose.model("Notification", schema);
