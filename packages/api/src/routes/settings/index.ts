import { Hono } from "hono";

import { requireAuth } from "@/middleware/auth";

import { accountRoutes } from "./account";
import { credentialRoutes } from "./credentials";
import { emailRoutes } from "./email";
import { notificationPreferencesRoutes } from "./notifications";
import { passwordRoutes } from "./password";
import { dataExportRoute, privacyRoutes } from "./privacy";
import { securityRoutes } from "./security";
import { sessionRoutes } from "./sessions";
import { twoFactorDisableRoutes } from "./two-factor";
import { usernameRoutes } from "./username";
import { verificationRoutes } from "./verifications";

const settingsRoutes = new Hono();

// All settings routes require authentication
settingsRoutes.use("*", requireAuth);

settingsRoutes.route("/password", passwordRoutes);
settingsRoutes.route("/email", emailRoutes);
settingsRoutes.route("/username", usernameRoutes);
settingsRoutes.route("/2fa", twoFactorDisableRoutes);
settingsRoutes.route("/credentials", credentialRoutes);
settingsRoutes.route("/sessions", sessionRoutes);
settingsRoutes.route("/account", accountRoutes);
settingsRoutes.route("/verifications", verificationRoutes);
settingsRoutes.route("/security", securityRoutes);
settingsRoutes.route("/notifications", notificationPreferencesRoutes);
settingsRoutes.route("/privacy", privacyRoutes);
settingsRoutes.route("/data-export", dataExportRoute);

export { settingsRoutes };
