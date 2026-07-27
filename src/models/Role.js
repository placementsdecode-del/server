const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ["superadmin", "admin", "teacher", "student"],
      required: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcceptedOrganization",
      default: null,
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isEditable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

roleSchema.index({ name: 1, organization: 1 }, { unique: true });

module.exports = mongoose.model("Role", roleSchema);
