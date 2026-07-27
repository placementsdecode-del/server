const ApiError = require("../utils/apiError");
const Role = require("../models/Role");
const asyncHandler = require("../utils/asyncHandler");
const {
  ensureOrganizationRoles,
  getAllowedPermissions,
  getRoleDefinitions,
} = require("../services/rbac.service");

const listPermissions = asyncHandler(async (req, res) => {
  res.json({ permissions: getAllowedPermissions() });
});

const listRoleDefinitions = asyncHandler(async (req, res) => {
  res.json({ roles: getRoleDefinitions() });
});

const listRoles = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.roleName === "superadmin") {
    if (req.query.organization) {
      filter.organization = req.query.organization;
    }
  } else {
    filter.organization = req.user.organization;
  }

  const roles = await Role.find(filter).populate("organization", "orgName orgEmail").sort({
    organization: 1,
    name: 1,
  });

  res.json({ roles });
});

const syncOrganizationRoles = asyncHandler(async (req, res) => {
  const organizationId = req.params.organizationId || req.body.organization;

  if (!organizationId) {
    throw new ApiError(400, "organization is required");
  }

  if (req.user.roleName !== "superadmin" && req.user.organization.toString() !== organizationId) {
    throw new ApiError(403, "You can only sync roles for your own organization");
  }

  const roles = await ensureOrganizationRoles(organizationId);
  res.json({ message: "Organization roles are ready", roles });
});

const updateRole = asyncHandler(async (req, res) => {
  const { displayName, description, permissions } = req.body;
  const role = await Role.findById(req.params.roleId);

  if (!role) {
    throw new ApiError(404, "Role not found");
  }

  if (role.name === "superadmin" || !role.isEditable) {
    throw new ApiError(403, "This role cannot be edited");
  }

  if (req.user.roleName !== "superadmin") {
    if (!role.organization || role.organization.toString() !== req.user.organization.toString()) {
      throw new ApiError(403, "You can only edit your own organization roles");
    }
  }

  if (permissions) {
    const allowed = getAllowedPermissions();
    const invalid = permissions.filter((permission) => !allowed.includes(permission));

    if (invalid.length) {
      throw new ApiError(400, `Invalid permissions: ${invalid.join(", ")}`);
    }

    role.permissions = permissions;
  }

  if (displayName) {
    role.displayName = displayName;
  }

  if (description !== undefined) {
    role.description = description;
  }

  await role.save();
  res.json({ message: "Role updated", role });
});

module.exports = {
  listPermissions,
  listRoleDefinitions,
  listRoles,
  syncOrganizationRoles,
  updateRole,
};
