import { Hono } from "hono";
import { loginRoutes } from "./login";
import { logoutRoutes } from "./logout";
import { registerRoutes } from "./register";
import { resetRoutes } from "./reset";
import { twoFactorRoutes } from "./two-factor";
import { verifyRoutes } from "./verify";

const authRoutes = new Hono();

authRoutes.route("/login", loginRoutes);
authRoutes.route("/register", registerRoutes);
authRoutes.route("/verify", verifyRoutes);
authRoutes.route("/2fa", twoFactorRoutes);
authRoutes.route("/", resetRoutes); // /forgot-password and /reset-password
authRoutes.route("/logout", logoutRoutes);

export { authRoutes };
