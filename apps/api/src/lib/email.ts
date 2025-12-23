import { env } from "@workspaces/shared";
import { Resend } from "resend";

const resend = new Resend(env.RESEND_API_KEY);

export const emailService = {
  async sendVerificationCode(email: string, code: string) {
    if (env.NODE_ENV === "development") {
      console.log(`[DEV] Verification Code for ${email}: ${code}`);
      return;
    }

    await resend.emails.send({
      from: "Scrimflow <onboarding@mail.scrimflow.com>",
      to: email,
      subject: "Votre code de vérification",
      html: `
        <div>
          <h1>Bienvenue !</h1>
          <p>Votre code de vérification est : <strong>${code}</strong></p>
          <p>Ce code expire dans 15 minutes.</p>
        </div>
      `,
    });
  },

  async sendNewIpNotification(email: string, ip: string, location?: string) {
    await resend.emails.send({
      from: "Scrimflow <security@mail.scrimflow.com>",
      to: email,
      subject: "Nouvelle connexion détectée",
      html: `
        <div>
          <h1>Alerte de sécurité</h1>
          <p>Une connexion à votre compte a été détectée depuis une nouvelle adresse IP : <strong>${ip}</strong></p>
          ${location ? `<p>Localisation approximative : ${location}</p>` : ""}
          <p>Si ce n'était pas vous, veuillez changer votre mot de passe immédiatement.</p>
        </div>
      `,
    });
  },
};
