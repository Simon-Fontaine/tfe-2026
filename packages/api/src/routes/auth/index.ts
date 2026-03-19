import { Hono } from "hono";
import { loginRoutes } from "./login";
import { registerRoutes } from "./register";
import { verifyRoutes } from "./verify";
import { twoFactorRoutes } from "./two-factor";
import { resetRoutes } from "./reset";
import { logoutRoutes } from "./logout";

const authRoutes = new Hono();

authRoutes.route("/login", loginRoutes);
authRoutes.route("/register", registerRoutes);
authRoutes.route("/verify", verifyRoutes);
authRoutes.route("/2fa", twoFactorRoutes);
authRoutes.route("/", resetRoutes); // /forgot-password and /reset-password
authRoutes.route("/logout", logoutRoutes);

export { authRoutes };
