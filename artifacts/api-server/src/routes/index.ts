import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studyPartiesRouter from "./study-parties";
import assistantRouter from "./assistant";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studyPartiesRouter);
router.use(assistantRouter);

export default router;
