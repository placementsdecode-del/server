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

export { listOrganizations, getOrganization };
