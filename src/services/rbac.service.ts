import Role from "../models/Role";

const permissions = [
  "features:manage",
  "organizations:review",
  "organizations:read",
  "organization:read",
  "roles:read",
  "roles:manage",
  "users:manage",
  "students:manage",
  "students:read",
  "teachers:manage",
  "profile:read",
];

const roleDefinitions = {
  superadmin: {
    displayName: "Super Admin",
    description: "Platform owner who reviews organizations, manages features, roles, and users.",
    permissions: [
      "features:manage",
      "organizations:review",
      "organizations:read",
      "roles:read",
      "roles:manage",
      "users:manage",
    ],
    isEditable: false,
  },
  admin: {
    displayName: "Organization Admin",
    description: "Organization-level admin who manages teachers, students, and local users.",
    permissions: [
      "organization:read",
      "roles:read",
      "users:manage",
      "students:manage",
      "teachers:manage",
    ],
    isEditable: true,
  },
  teacher: {
    displayName: "Teacher",
    description: "Teacher user who can view organization data and assigned students.",
    permissions: ["organization:read", "students:read", "profile:read"],
    isEditable: true,
  },
  student: {
    displayName: "Student",
    description: "Student user with profile-level access.",
    permissions: ["organization:read", "profile:read"],
    isEditable: true,
  },
};

async function ensureRole(name, organization = null, isSystem = false) {
  const definition = roleDefinitions[name];

  return Role.findOneAndUpdate(
    { name, organization },
    {
      $setOnInsert: {
        name,
        organization,
        isSystem,
        displayName: definition.displayName,
        description: definition.description,
        permissions: definition.permissions,
        isEditable: definition.isEditable,
      },
    },
    { upsert: true, new: true }
  );
}

async function ensureOrganizationRoles(organizationId) {
  const [admin, teacher, student] = await Promise.all([
    ensureRole("admin", organizationId),
    ensureRole("teacher", organizationId),
    ensureRole("student", organizationId),
  ]);

  return { admin, teacher, student };
}

function getAllowedPermissions() {
  return permissions;
}

function getRoleDefinitions() {
  return roleDefinitions;
}

export {
  ensureRole,
  ensureOrganizationRoles,
  getAllowedPermissions,
  getRoleDefinitions,
};
