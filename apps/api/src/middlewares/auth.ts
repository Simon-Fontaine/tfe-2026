import type { GLOBAL_ROLES } from "@workspaces/shared";
import { deleteCookie, getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { AuthService } from "../services/auth.service";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  globalRole: (typeof GLOBAL_ROLES)[number];
  avatarUrl: string | null;
};

export type AuthContext = {
  Variables: {
    user: AuthUser;
  };
};

export const requireAuth = createMiddleware<AuthContext>(async (c, next) => {
  const token = getCookie(c, "session_token");

  if (!token) {
    return c.json({ error: "Unauthorized - No token" }, 401);
  }

  try {
    const result = await AuthService.getSessionUser(token);

    if (!result) {
      deleteCookie(c, "session_token");
      return c.json({ error: "Unauthorized - Invalid session" }, 401);
    }

    c.set("user", {
      id: result.user.id,
      username: result.user.username,
      email: result.user.email,
      globalRole: result.user.globalRole,
      avatarUrl: result.user.avatarUrl,
    });

    await next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export const requireAdmin = createMiddleware<AuthContext>(async (c, next) => {
  const user = c.var.user;

  if (!user || user.globalRole !== "admin") {
    return c.json({ error: "Forbidden - Admins only" }, 403);
  }

  await next();
});
