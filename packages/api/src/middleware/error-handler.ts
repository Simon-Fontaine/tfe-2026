import type { ErrorHandler } from "hono";
import logger from "@/utils/logger";

export const errorHandler: ErrorHandler = (err, c) => {
	logger.error({ err, path: c.req.path, method: c.req.method }, "unhandled error");

	if (err instanceof Error && err.message === "Unauthorized") {
		return c.json({ error: "Unauthorized" }, 401);
	}

	return c.json({ error: "Internal server error" }, 500);
};
