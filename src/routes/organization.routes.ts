import { Router } from "express";

import { getOrganization, listOrganizations, updateOrganization } from "../controllers/organization.controller";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireRoles("superadmin", "admin"), listOrganizations);
router.get("/:organizationId", requireAuth, requireRoles("superadmin", "admin"), getOrganization);
router.patch("/:organizationId", requireAuth, requireRoles("superadmin", "admin"), updateOrganization);

export default router;
