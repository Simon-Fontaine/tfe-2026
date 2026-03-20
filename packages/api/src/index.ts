import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { requireAuth } from "@/middleware/auth";
import { errorHandler } from "@/middleware/error-handler";
import { requestContext } from "@/middleware/request-context";
import { authRoutes } from "@/routes/auth";
import { lfgRoutes } from "@/routes/lfg";
import { notificationRoutes } from "@/routes/notifications";
import { onboardingRoutes } from "@/routes/onboarding";
import { orgRoutes } from "@/routes/orgs";
import { profileRoutes } from "@/routes/profile";
import { scheduleRoutes } from "@/routes/schedule";
import { settingsRoutes } from "@/routes/settings";
import { teamRoutes } from "@/routes/teams";
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

app.use("/api/lfg/*", requireAuth);
app.route("/api/lfg", lfgRoutes);

app.use("/api/schedule/*", requireAuth);
app.route("/api/schedule", scheduleRoutes);

app.use("/api/notifications/*", requireAuth);
app.route("/api/notifications", notificationRoutes);

app.use("/api/uploads/*", requireAuth);
app.route("/api/uploads", uploadRoutes);

app.use("/api/users/*", requireAuth);
app.route("/api/users", userRoutes);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

export default {
	port: Number(process.env.API_PORT) || 3001,
	fetch: app.fetch,
};
