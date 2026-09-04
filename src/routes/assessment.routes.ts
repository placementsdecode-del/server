import { Router } from "express";

import {
  createAssessment,
  listAssessments,
  updateAssessment,
  validateAssessment,
} from "../controllers/assessment.controller";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireRoles("superadmin", "admin", "teacher"), listAssessments);
router.post("/", requireAuth, requireRoles("superadmin", "admin", "teacher"), createAssessment);
router.post("/validate", requireAuth, requireRoles("superadmin", "admin", "teacher"), validateAssessment);
router.patch("/:assessmentId", requireAuth, requireRoles("superadmin", "admin", "teacher"), updateAssessment);
router.post("/:assessmentId/validate", requireAuth, requireRoles("superadmin", "admin", "teacher"), validateAssessment);

export default router;
