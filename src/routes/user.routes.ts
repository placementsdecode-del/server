import { Router } from "express";

import { bulkCreateStudents, createUser, listUsers, updateUser } from "../controllers/user.controller";
import { requireAuth, requireRoles, requirePermission } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireRoles("superadmin", "admin", "teacher"), requirePermission('users:manage', 'students:read', 'students:manage'), listUsers);
router.post("/bulk-students", requireAuth, requireRoles("admin", "teacher"), bulkCreateStudents);
router.post("/", requireAuth, requireRoles("superadmin", "admin"), requirePermission('users:manage'), createUser);
router.patch("/:userId", requireAuth, requireRoles("superadmin", "admin"), requirePermission('users:manage'), updateUser);

export default router;
