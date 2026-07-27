const router = require("express").Router();

const {
  approveRegistration,
  createRegistration,
  getRegistration,
  listRegistrations,
  rejectRegistration,
} = require("../controllers/orgRegistration.controller");
const { requireAuth, requireRoles } = require("../middleware/auth");

router.post("/", createRegistration);
router.get("/", requireAuth, requireRoles("superadmin"), listRegistrations);
router.get("/:registrationId", requireAuth, requireRoles("superadmin"), getRegistration);
router.post("/:registrationId/approve", requireAuth, requireRoles("superadmin"), approveRegistration);
router.post("/:registrationId/reject", requireAuth, requireRoles("superadmin"), rejectRegistration);

module.exports = router;
