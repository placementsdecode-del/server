import { Router } from "express";

import {
  assignStudentToSection,
  createSection,
  listSections,
  updateSection,
} from "../controllers/section.controller";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireRoles("superadmin", "admin", "teacher"), listSections);
router.post("/", requireAuth, requireRoles("superadmin", "admin"), createSection);
router.patch("/:sectionId", requireAuth, requireRoles("superadmin", "admin"), updateSection);
router.post("/:sectionId/students/:studentId", requireAuth, requireRoles("superadmin", "admin", "teacher"), assignStudentToSection);

export default router;
