import { env, type SessionMetadataInput } from "@workspaces/shared";
import { Resend } from "resend";
import SecurityAlertEmail from "./emails/SecurityAlertEmail";
import VerificationEmail from "./emails/VerificationEmail";

const resend = new Resend(env.RESEND_API_KEY);

export type EmailVerificationType =
  | "EMAIL_VERIFICATION"
  | "PASSWORD_RESET"
  | "EMAIL_CHANGE";

export const emailService = {
  async sendVerificationCode(
    email: string,
    code: string,
    type: EmailVerificationType = "EMAIL_VERIFICATION",
  ) {
    let subject = "Verify your email for Scrimflow";
    let title = "Verify your email address";
    let message =
      "Use the code below to verify your email address and finish setting up your account.";
    let actionText = "enter the following code";

    switch (type) {
      case "PASSWORD_RESET":
        subject = "Reset your Scrimflow password";
        title = "Reset your password";
        message =
          "We received a request to reset your password. If you didn't ask for this, you can safely ignore this email.";
        actionText = "use this code to reset your password";
        break;
      case "EMAIL_CHANGE":
        subject = "Confirm your new email address";
        title = "Confirm email update";
        message =
          "You requested to change the email address associated with your Scrimflow account.";
        actionText = "enter this code to verify your new address";
        break;
    }

    if (env.NODE_ENV === "development") {
      console.log(`\n📨 [EMAIL DEV] To: ${email} | Subject: ${subject}`);
      console.log(`   Code: ${code} | Type: ${type}`);
    }

    try {
      await resend.emails.send({
        from: "Scrimflow <onboarding@mail.scrimflow.com>",
        to: email,
        subject: subject,
        react: VerificationEmail({ code, title, message, actionText }),
      });
    } catch (error) {
      console.error(
        "❌ [EMAIL ERROR] Failed to send verification code:",
        error,
      );
    }
  },

  async sendNewIpNotification(
    email: string,
    metadata: SessionMetadataInput,
    timezone: string = "UTC",
  ) {
    const ip = metadata.ipAddress ?? "unknown";
    const location = formatLocation(metadata.location);
    const now = new Date();
    const datePart = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(now);
    const timePart = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(now);
    const date = `${datePart} at ${timePart}`;

    if (env.NODE_ENV === "development") {
      console.log(`\n🚨 [SECURITY DEV] To: ${email} | New IP: ${ip}`);
    }

    try {
      await resend.emails.send({
        from: "Scrimflow Security <security@mail.scrimflow.com>",
        to: email,
        subject: "New login to Scrimflow detected",
        react: SecurityAlertEmail({ ip, location, date }),
      });
    } catch (error) {
      console.error("❌ [EMAIL ERROR] Failed to send security alert:", error);
    }
  },
};

function formatLocation(
  location?: SessionMetadataInput["location"],
): string | undefined {
  if (!location) return undefined;

  const parts = [location.city, location.region, location.country].filter(
    Boolean,
  );

  return parts.length ? parts.join(", ") : undefined;
}
