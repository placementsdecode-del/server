import { Router } from "express";

import { bulkCreateStudents, createUser, listUsers, updateUser } from "../controllers/user.controller";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireRoles("superadmin", "admin", "teacher"), listUsers);
router.post("/bulk-students", requireAuth, requireRoles("admin", "teacher"), bulkCreateStudents);
router.post("/", requireAuth, requireRoles("superadmin", "admin"), createUser);
router.patch("/:userId", requireAuth, requireRoles("superadmin", "admin"), updateUser);

export default router;
