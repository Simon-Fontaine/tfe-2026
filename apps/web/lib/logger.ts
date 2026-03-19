import pino from "pino";

const logger = pino({
	name: "scrimflow",
	level: process.env.LOG_LEVEL || "info",
	transport:
		process.env.NODE_ENV === "development"
			? { target: "pino-pretty", options: { colorize: true } }
			: undefined,
});

export default logger;
