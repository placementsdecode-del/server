import AcceptedOrganization from "../models/AcceptedOrganization";
import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";

const listOrganizations = asyncHandler(async (req, res) => {
  const filter = req.user.roleName === "superadmin" ? {} : { _id: req.user.organization };
  const organizations = await AcceptedOrganization.find(filter)
    .populate("features")
    .populate("adminUser", "name email roleName")
    .sort({ createdAt: -1 });

  res.json({ organizations });
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

  const allowedFields = ["orgName", "orgEmail", "address", "location", "phoneNumber", "features", "status"];
  const update: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      update[field] = req.body[field];
    }
  }

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
