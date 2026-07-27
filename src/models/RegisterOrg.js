const mongoose = require("mongoose");

const registerOrgSchema = new mongoose.Schema(
  {
    externalId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    orgName: {
      type: String,
      required: true,
      trim: true,
    },
    orgEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    requestedFeatures: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Feature",
      },
    ],
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    discussionNotes: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    acceptedOrganization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcceptedOrganization",
      default: null,
    },
  },
  { timestamps: true }
);

registerOrgSchema.index({ orgEmail: 1, status: 1 });

module.exports = mongoose.model("RegisterOrg", registerOrgSchema);
