import { Router } from "express";

import { createUser, listUsers } from "../controllers/user.controller";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireRoles("superadmin", "admin"), listUsers);
router.post("/", requireAuth, requireRoles("superadmin", "admin"), createUser);

export default router;
