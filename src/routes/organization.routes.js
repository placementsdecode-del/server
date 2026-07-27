const router = require("express").Router();

const { getOrganization, listOrganizations } = require("../controllers/organization.controller");
const { requireAuth, requireRoles } = require("../middleware/auth");

router.get("/", requireAuth, requireRoles("superadmin", "admin"), listOrganizations);
router.get("/:organizationId", requireAuth, requireRoles("superadmin", "admin"), getOrganization);

module.exports = router;
