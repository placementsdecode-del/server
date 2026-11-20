import AcceptedOrganization from "../models/AcceptedOrganization";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";
import { resolveFeatureIds } from "../services/feature.service";
import User from '../models/User';

const listOrganizations = asyncHandler(async (req, res) => {
  const filter = req.user.roleName === "superadmin" ? {} : { _id: req.user.organization };
  const organizations = await AcceptedOrganization.find(filter)
    .populate("features")
    .populate("adminUser", "name email roleName")
    .sort({ createdAt: -1 });

  const counts = await User.aggregate([
    { $match: { organization: { $in: organizations.map(organization => organization._id) } } },
    { $group: { _id: '$organization', students: { $sum: { $cond: [{ $eq: ['$roleName', 'student'] }, 1, 0] } },
      coordinators: { $sum: { $cond: [{ $eq: ['$roleName', 'teacher'] }, 1, 0] } },
      total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } },
  ]);
  const byOrganization = new Map(counts.map(row => [String(row._id), row]));
  res.json({ organizations: organizations.map(organization => ({ ...organization.toObject(), memberCounts: byOrganization.get(String(organization._id)) || { students: 0, coordinators: 0, total: 0, active: 0 } })) });
});

const getOrganization = asyncHandler(async (req, res) => {
  const organizationId = req.params.organizationId;

  if (req.user.roleName !== "superadmin" && req.user.organization.toString() !== organizationId) {
    throw new ApiError(403, "You can only view your own organization");
  }

  const organization = await AcceptedOrganization.findById(organizationId)
    .populate("features")
    .populate("adminUser", "name email roleName");

  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  res.json({ organization });
});

const updateOrganization = asyncHandler(async (req, res) => {
  const organizationId = req.params.organizationId;

  if (req.user.roleName !== "superadmin" && req.user.organization.toString() !== organizationId) {
    throw new ApiError(403, "You can only update your own organization");
  }

  if (req.user.roleName !== 'superadmin' && (req.body.features !== undefined || req.body.status !== undefined)) {
    throw new ApiError(403, 'Platform administrators manage organization status and features');
  }
  const allowedFields = ["orgName", "orgEmail", "address", "location", "phoneNumber", "status"];
  const update: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      update[field] = req.body[field];
    }
  }
  if (req.body.features !== undefined) update.features = await resolveFeatureIds(req.body.features);

  if (update.status && !["active", "suspended"].includes(String(update.status))) {
    throw new ApiError(400, "status must be active or suspended");
  }

  const organization = await AcceptedOrganization.findByIdAndUpdate(organizationId, update, {
    new: true,
    runValidators: true,
  })
    .populate("features")
    .populate("adminUser", "name email roleName");

  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  res.json({ message: "Organization updated", organization });
});

export { listOrganizations, getOrganization, updateOrganization };
