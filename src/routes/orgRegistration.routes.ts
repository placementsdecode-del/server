import { Router } from "express";

import {
  approveRegistration,
  createRegistration,
  getRegistration,
  listRegistrations,
  rejectRegistration,
} from "../controllers/orgRegistration.controller";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();

router.post("/", createRegistration);
router.get("/", requireAuth, requireRoles("superadmin"), listRegistrations);
router.get("/:registrationId", requireAuth, requireRoles("superadmin"), getRegistration);
router.post("/:registrationId/approve", requireAuth, requireRoles("superadmin"), approveRegistration);
router.post("/:registrationId/reject", requireAuth, requireRoles("superadmin"), rejectRegistration);

export default router;
