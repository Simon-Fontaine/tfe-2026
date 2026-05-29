import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { requireAuth } from "@/middleware/auth";
import { errorHandler } from "@/middleware/error-handler";
import { requestContext } from "@/middleware/request-context";
import { authRoutes } from "@/routes/auth";
import { chatRoutes } from "@/routes/chat";
import { heroRoutes } from "@/routes/heroes";
import { moderationRoutes } from "@/routes/moderation";
import { notificationRoutes } from "@/routes/notifications";
import { onboardingRoutes } from "@/routes/onboarding";
import { orgRoutes } from "@/routes/orgs";
import { publicOrgRoutes } from "@/routes/orgs/public";
import { publicPlayerRoutes } from "@/routes/players/public";
import { profileRoutes } from "@/routes/profile";
import { realtimeRoutes } from "@/routes/realtime";
import {
	publicRecruitmentListingsRoutes,
	recruitmentApplicationsRoutes,
	recruitmentConversationsRoutes,
	recruitmentListingsRoutes,
} from "@/routes/recruitment";
import { reportRoutes } from "@/routes/reports";
import { scheduleRoutes } from "@/routes/schedule";
import { publicScrimRoutes, scrimRoutes } from "@/routes/scrims";
import { settingsRoutes } from "@/routes/settings";
import { publicStatsRoutes } from "@/routes/stats/public";
import { teamRoutes } from "@/routes/teams";
import { publicTeamRoutes } from "@/routes/teams/public";
import { publicUpdatesRoutes, updatesRoutes } from "@/routes/updates";
import { uploadRoutes } from "@/routes/uploads";
import { userRoutes } from "@/routes/users";
import { websocket } from "@/websocket";

const app = new Hono();

// Global middleware
app.use("*", honoLogger());
app.use("*", requestContext);

// Error handling
app.onError(errorHandler);

// Routes — auth (has its own middleware)
app.route("/api/auth", authRoutes);
app.route("/api/settings", settingsRoutes);

// Routes — domain (all require auth)
app.use("/api/profile/*", requireAuth);
app.route("/api/profile", profileRoutes);

app.use("/api/onboarding/*", requireAuth);
app.route("/api/onboarding", onboardingRoutes);

app.use("/api/orgs/*", requireAuth);
app.route("/api/orgs", orgRoutes);

app.use("/api/teams/*", requireAuth);
app.route("/api/teams", teamRoutes);

app.use("/api/recruitment/listings/*", requireAuth);
app.route("/api/recruitment/listings", recruitmentListingsRoutes);

app.use("/api/recruitment/applications/*", requireAuth);
app.route("/api/recruitment/applications", recruitmentApplicationsRoutes);

app.use("/api/recruitment/conversations/*", requireAuth);
app.route("/api/recruitment/conversations", recruitmentConversationsRoutes);

app.use("/api/schedule/*", requireAuth);
app.route("/api/schedule", scheduleRoutes);

app.use("/api/notifications/*", requireAuth);
app.route("/api/notifications", notificationRoutes);

app.use("/api/chat/*", requireAuth);
app.route("/api/chat", chatRoutes);

app.use("/api/scrims/*", requireAuth);
app.route("/api/scrims", scrimRoutes);

app.use("/api/realtime/*", requireAuth);
app.route("/api/realtime", realtimeRoutes);

app.use("/api/reports/*", requireAuth);
app.route("/api/reports", reportRoutes);

app.use("/api/moderation/*", requireAuth);
app.route("/api/moderation", moderationRoutes);

app.use("/api/updates/*", requireAuth);
app.route("/api/updates", updatesRoutes);

app.use("/api/uploads/*", requireAuth);
app.route("/api/uploads", uploadRoutes);

app.use("/api/users/*", requireAuth);
app.route("/api/users", userRoutes);

// Public routes (no auth)
app.route("/api/heroes", heroRoutes);
app.route("/api/public/teams", publicTeamRoutes);
app.route("/api/public/orgs", publicOrgRoutes);
app.route("/api/public/players", publicPlayerRoutes);
app.route("/api/public/stats", publicStatsRoutes);
app.route("/api/public/recruitment/listings", publicRecruitmentListingsRoutes);
app.route("/api/public/scrims", publicScrimRoutes);
app.route("/api/public/updates", publicUpdatesRoutes);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

export default {
	port: Number(process.env.API_PORT) || 3001,
	fetch: app.fetch,
	websocket,
};
