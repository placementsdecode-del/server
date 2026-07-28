import Feature from "../models/Feature";
import { ensureDefaultFeatures } from "../services/feature.service";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";

const listFeatures = asyncHandler(async (req, res) => {
  await ensureDefaultFeatures();

  const filter = req.user && req.user.roleName === "superadmin" ? {} : { isActive: true };
  const features = await Feature.find(filter).sort({ name: 1 });
  res.json({ features });
});

const createFeature = asyncHandler(async (req, res) => {
  const { key, name, description, enabledByDefault } = req.body;

  if (!key || !name) {
    throw new ApiError(400, "Feature key and name are required");
  }

  const feature = await Feature.create({ key, name, description, enabledByDefault });
  res.status(201).json({ feature });
});

const updateFeature = asyncHandler(async (req, res) => {
  const feature = await Feature.findByIdAndUpdate(req.params.featureId, req.body, {
    new: true,
    runValidators: true,
  });

  if (!feature) {
    throw new ApiError(404, "Feature not found");
  }

  res.json({ feature });
});

export { listFeatures, createFeature, updateFeature };
