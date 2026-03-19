import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { errorHandler } from "@/middleware/error-handler";
import { requestContext } from "@/middleware/request-context";
import { authRoutes } from "@/routes/auth";

const app = new Hono();

// Global middleware
app.use("*", honoLogger());
app.use("*", requestContext);

// Error handling
app.onError(errorHandler);

// Routes
app.route("/api/auth", authRoutes);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

export default {
	port: Number(process.env.API_PORT) || 3001,
	fetch: app.fetch,
};
