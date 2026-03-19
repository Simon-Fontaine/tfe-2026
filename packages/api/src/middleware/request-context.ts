import { createMiddleware } from "hono/factory";
import { type ClientContext, extractClientContext } from "@/auth/device";

export type RequestContextEnv = {
	Variables: {
		client: ClientContext;
	};
};

export const requestContext = createMiddleware<RequestContextEnv>(async (c, next) => {
	const headerGetter = {
		get: (name: string) => c.req.header(name) ?? null,
	};
	const client = extractClientContext(headerGetter);
	c.set("client", client);
	await next();
});
