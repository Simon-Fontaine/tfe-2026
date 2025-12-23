import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import auth from "./routes/auth";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

const routes = app.route("/auth", auth);

export default app;
export type AppType = typeof routes;
