import mongoose from "mongoose";

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
    location: {
      country: {
        type: String,
        trim: true,
        default: "",
      },
      state: {
        type: String,
        trim: true,
        default: "",
      },
      city: {
        type: String,
        trim: true,
        default: "",
      },
      postalCode: {
        type: String,
        trim: true,
        default: "",
      },
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

export default mongoose.model("AcceptedOrganization", acceptedOrganizationSchema);
