import { Router } from "express";

import {
  listPermissions,
  listRoleDefinitions,
  listRoles,
  syncOrganizationRoles,
  updateRole,
} from "../controllers/role.controller";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireRoles("superadmin", "admin"), listRoles);
router.get("/definitions", requireAuth, requireRoles("superadmin", "admin"), listRoleDefinitions);
router.get("/permissions", requireAuth, requireRoles("superadmin", "admin"), listPermissions);
router.post("/organizations/:organizationId/sync", requireAuth, requireRoles("superadmin", "admin"), syncOrganizationRoles);
router.patch("/:roleId", requireAuth, requireRoles("superadmin", "admin"), updateRole);

export default router;
