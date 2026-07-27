import { Router } from "express";

import { createFeature, listFeatures, updateFeature } from "../controllers/feature.controller";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();

router.get("/", listFeatures);
router.post("/", requireAuth, requireRoles("superadmin"), createFeature);
router.patch("/:featureId", requireAuth, requireRoles("superadmin"), updateFeature);

export default router;
