const router = require("express").Router();

const { createFeature, listFeatures, updateFeature } = require("../controllers/feature.controller");
const { requireAuth, requireRoles } = require("../middleware/auth");

router.get("/", listFeatures);
router.post("/", requireAuth, requireRoles("superadmin"), createFeature);
router.patch("/:featureId", requireAuth, requireRoles("superadmin"), updateFeature);

module.exports = router;
