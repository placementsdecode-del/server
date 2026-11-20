import { Router } from "express";

import { changePassword, login, me, updateProfile } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/login", login);
router.get("/me", requireAuth, me);
router.patch('/profile', requireAuth, updateProfile);
router.patch("/password", requireAuth, changePassword);

export default router;
