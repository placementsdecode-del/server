const mongoose = require("mongoose");

const acceptedOrganizationSchema = new mongoose.Schema(
  {
    registrationRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegisterOrg",
      required: true,
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
      unique: true,
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
    features: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Feature",
      },
    ],
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
    credentialsSentAt: {
      type: Date,
      default: null,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AcceptedOrganization", acceptedOrganizationSchema);
