import { SecurityAlertEmail, type SecurityAlertType } from "@/emails/SecurityAlertEmail";
import { formatLocation, type GeoData } from "@/lib/geo";
import logger from "@/lib/logger";
import { sendMail } from "@/lib/mailer";

export async function sendSecurityAlertEmail({
	to,
	ip,
	device,
	geo,
	alertType,
	twoFactorMethod,
}: {
	to: string;
	ip: string | null;
	device: string | null;
	geo?: GeoData;
	alertType: SecurityAlertType;
	twoFactorMethod?: "totp" | "passkey" | "security_key";
}) {
	const subjectMap: Record<SecurityAlertType, string> = {
		new_device: "New device sign-in on Scrimflow",
		new_location: "New location sign-in on Scrimflow",
		suspicious: "Suspicious sign-in attempt on Scrimflow",
		password_changed: "Your Scrimflow password was changed",
		email_changed: "Your Scrimflow email address was changed",
		two_factor_enabled: "Two-factor authentication enabled on Scrimflow",
		two_factor_disabled: "Two-factor authentication disabled on Scrimflow",
	};

	try {
		await sendMail({
			to,
			subject: subjectMap[alertType],
			template: (
				<SecurityAlertEmail
					ip={ip ?? "Unknown"}
					device={device ?? "Unknown Device"}
					location={geo ? formatLocation(geo) : "Unknown Location"}
					date={new Date().toUTCString()}
					alertType={alertType}
					twoFactorMethod={twoFactorMethod}
				/>
			),
		});
	} catch (err) {
		logger.error({ err, alertType, to }, "security alert email send failed");
	}
}
