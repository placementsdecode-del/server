import { Router } from "express";

import { getOrganization, listOrganizations } from "../controllers/organization.controller";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireRoles("superadmin", "admin"), listOrganizations);
router.get("/:organizationId", requireAuth, requireRoles("superadmin", "admin"), getOrganization);

export default router;
