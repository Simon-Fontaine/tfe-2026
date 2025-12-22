import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono();

app.use("*", logger());

const routes = app.get("/", (c) => {
  return c.json({ message: "Hello, World!" });
});

export default app;
export type AppType = typeof routes;
