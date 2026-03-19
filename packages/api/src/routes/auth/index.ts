import { Hono } from "hono";
import { loginRoutes } from "./login";
import { logoutRoutes } from "./logout";
import { registerRoutes } from "./register";
import { resetRoutes } from "./reset";
import { totpSetupRoutes } from "./totp-setup";
import { twoFactorRoutes } from "./two-factor";
import { verifyRoutes } from "./verify";
import { webauthnRoutes } from "./webauthn";
import { webauthnSetupRoutes } from "./webauthn-setup";

const authRoutes = new Hono();

authRoutes.route("/login", loginRoutes);
authRoutes.route("/register", registerRoutes);
authRoutes.route("/verify", verifyRoutes);
authRoutes.route("/2fa", twoFactorRoutes);
authRoutes.route("/webauthn", webauthnRoutes);
authRoutes.route("/totp", totpSetupRoutes);
authRoutes.route("/credentials", webauthnSetupRoutes);
authRoutes.route("/", resetRoutes); // /forgot-password and /reset-password
authRoutes.route("/logout", logoutRoutes);

export { authRoutes };
