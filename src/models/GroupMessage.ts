import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 5000 },
}, { timestamps: true });
schema.index({ group: 1, createdAt: -1 });
export default mongoose.model('GroupMessage', schema);
