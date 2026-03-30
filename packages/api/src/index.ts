import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { requireAuth } from "@/middleware/auth";
import { errorHandler } from "@/middleware/error-handler";
import { requestContext } from "@/middleware/request-context";
import { authRoutes } from "@/routes/auth";
import { chatRoutes } from "@/routes/chat";
import { heroRoutes } from "@/routes/heroes";
import { notificationRoutes } from "@/routes/notifications";
import { onboardingRoutes } from "@/routes/onboarding";
import { orgRoutes } from "@/routes/orgs";
import { publicOrgRoutes } from "@/routes/orgs/public";
import { publicPlayerRoutes } from "@/routes/players/public";
import { postsRoutes } from "@/routes/posts";
import { publicPostsRoutes } from "@/routes/posts/public";
import { profileRoutes } from "@/routes/profile";
import { responsesRoutes } from "@/routes/responses";
import { scheduleRoutes } from "@/routes/schedule";
import { settingsRoutes } from "@/routes/settings";
import { teamRoutes } from "@/routes/teams";
import { publicTeamRoutes } from "@/routes/teams/public";
import { uploadRoutes } from "@/routes/uploads";
import { userRoutes } from "@/routes/users";

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

app.use("/api/posts/*", requireAuth);
app.route("/api/posts", postsRoutes);

app.use("/api/responses/*", requireAuth);
app.route("/api/responses", responsesRoutes);

app.use("/api/schedule/*", requireAuth);
app.route("/api/schedule", scheduleRoutes);

app.use("/api/notifications/*", requireAuth);
app.route("/api/notifications", notificationRoutes);

app.use("/api/chat/*", requireAuth);
app.route("/api/chat", chatRoutes);

app.use("/api/uploads/*", requireAuth);
app.route("/api/uploads", uploadRoutes);

app.use("/api/users/*", requireAuth);
app.route("/api/users", userRoutes);

// Public routes (no auth)
app.route("/api/heroes", heroRoutes);
app.route("/api/public/teams", publicTeamRoutes);
app.route("/api/public/orgs", publicOrgRoutes);
app.route("/api/public/players", publicPlayerRoutes);
app.route("/api/public/posts", publicPostsRoutes);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

export default {
	port: Number(process.env.API_PORT) || 3001,
	fetch: app.fetch,
};
