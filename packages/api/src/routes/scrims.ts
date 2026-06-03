import { Hono } from "hono";
import type { AuthEnv } from "@/middleware/auth";
import { registerScrimConfirmRespondRoutes } from "@/routes/scrims/confirm-respond";
import { registerScrimListCreateRoutes } from "@/routes/scrims/list-create";
import { registerScrimMapStatsRoutes } from "@/routes/scrims/map-stats-routes";
import { registerPublicScrimRoutes, registerScrimOcrRoutes } from "@/routes/scrims/ocr-public";
import { registerScrimResultRoutes } from "@/routes/scrims/results-routes";

const scrimRoutes = new Hono<AuthEnv>();
const publicScrimRoutes = new Hono<AuthEnv>();

registerScrimListCreateRoutes(scrimRoutes);
registerScrimConfirmRespondRoutes(scrimRoutes);
registerScrimResultRoutes(scrimRoutes);
registerScrimMapStatsRoutes(scrimRoutes);
registerScrimOcrRoutes(scrimRoutes);
registerPublicScrimRoutes(publicScrimRoutes);

export { publicScrimRoutes, scrimRoutes };
