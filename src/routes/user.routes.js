const router = require("express").Router();

const { createUser, listUsers } = require("../controllers/user.controller");
const { requireAuth, requireRoles } = require("../middleware/auth");

router.get("/", requireAuth, requireRoles("superadmin", "admin"), listUsers);
router.post("/", requireAuth, requireRoles("superadmin", "admin"), createUser);

module.exports = router;
