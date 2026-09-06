import { Router } from "express";
import { requireAuth, requireRoles } from "../middleware/auth";
import { listWork, createWork, publishWork } from "../controllers/work.controller";
const router = Router();
router.use(requireAuth, requireRoles("admin", "teacher"));
router.get("/", listWork);
router.post("/", createWork);
router.post("/:workId/publish", publishWork);
export default router;
