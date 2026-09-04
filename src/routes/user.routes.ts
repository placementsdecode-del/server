import { Router } from "express";

import { createUser, listUsers, updateUser } from "../controllers/user.controller";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireRoles("superadmin", "admin"), listUsers);
router.post("/", requireAuth, requireRoles("superadmin", "admin"), createUser);
router.patch("/:userId", requireAuth, requireRoles("superadmin", "admin"), updateUser);

export default router;
