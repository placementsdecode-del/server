import mongoose from "mongoose";

import Feature from "../models/Feature";
import ApiError from "../utils/apiError";

const defaultFeatures = [
  {
    key: "student-management",
    name: "Student Management",
    description: "Create and manage student accounts.",
    enabledByDefault: true,
  },
  {
    key: "teacher-management",
    name: "Teacher Management",
    description: "Create and manage teacher accounts.",
    enabledByDefault: true,
  },
  {
    key: "student-workspace",
    name: "Student Workspace",
    description: "Student dashboard and workspace access.",
    enabledByDefault: true,
  },
  {
    key: "assessments",
    name: "Assessments",
    description: "Assessment creation, assignment, and tracking.",
    enabledByDefault: false,
  },
  {
    key: "analytics",
    name: "Analytics",
    description: "Organization analytics and reporting.",
    enabledByDefault: false,
  },
  {
    key: "placement-drives",
    name: "Placement Drives",
    description: "Manage placement drives and related workflows.",
    enabledByDefault: false,
  },
  {
    key: "reports",
    name: "Reports",
    description: "View organization-level placement reports.",
    enabledByDefault: false,
  },
];

async function ensureDefaultFeatures() {
  return Promise.all(
    defaultFeatures.map((feature) =>
      Feature.findOneAndUpdate({ key: feature.key }, { $setOnInsert: feature }, { upsert: true, new: true })
    )
  );
}

async function resolveFeatureIds(values: unknown) {
  if (!values) {
    return [];
  }

  if (!Array.isArray(values)) {
    throw new ApiError(400, "requestedFeatures/features must be an array");
  }

  await ensureDefaultFeatures();

  const uniqueValues = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  const ids = uniqueValues.filter((value) => mongoose.isValidObjectId(value));
  const keys = uniqueValues.filter((value) => !mongoose.isValidObjectId(value)).map((value) => value.toLowerCase());

  const featuresByKey = keys.length ? await Feature.find({ key: { $in: keys }, isActive: true }) : [];
  const foundKeys = new Set(featuresByKey.map((feature) => feature.key));
  const missingKeys = keys.filter((key) => !foundKeys.has(key));

  if (missingKeys.length) {
    throw new ApiError(400, `Unknown feature keys: ${missingKeys.join(", ")}`);
  }

  return [...ids, ...featuresByKey.map((feature) => feature._id)];
}

export { defaultFeatures, ensureDefaultFeatures, resolveFeatureIds };
