const router = require("express").Router();

const {
  listPermissions,
  listRoleDefinitions,
  listRoles,
  syncOrganizationRoles,
  updateRole,
} = require("../controllers/role.controller");
const { requireAuth, requireRoles } = require("../middleware/auth");

router.get("/", requireAuth, requireRoles("superadmin", "admin"), listRoles);
router.get("/definitions", requireAuth, requireRoles("superadmin", "admin"), listRoleDefinitions);
router.get("/permissions", requireAuth, requireRoles("superadmin", "admin"), listPermissions);
router.post("/organizations/:organizationId/sync", requireAuth, requireRoles("superadmin", "admin"), syncOrganizationRoles);
router.patch("/:roleId", requireAuth, requireRoles("superadmin", "admin"), updateRole);

module.exports = router;
