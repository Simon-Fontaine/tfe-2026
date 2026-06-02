import { writeAuditLog } from "@/auth/audit";
import type { ClientContext } from "@/auth/device";
import { sendMail } from "@/email/mailer";
import { SecurityAlertEmail, type SecurityAlertType } from "@/email/templates/SecurityAlertEmail";
import { createNotification } from "@/notifications";
import { formatLocation, type GeoData } from "@/utils/geo";
import logger from "@/utils/logger";

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

/**
 * Fans out a new-device / new-location sign-in alert: emails the user, writes an
 * audit log entry, and creates an in-app notification. Email and notification are
 * fire-and-forget; failures are logged but never block the sign-in.
 */
export function sendNewLoginAlert({
	user,
	client,
	geo,
	isNewDevice,
}: {
	user: { id: string; email: string };
	client: ClientContext;
	geo: GeoData;
	isNewDevice: boolean;
}): void {
	void sendSecurityAlertEmail({
		to: user.email,
		ip: client.ip,
		device: client.deviceName,
		geo,
		alertType: isNewDevice ? "new_device" : "new_location",
	});

	writeAuditLog(
		user.id,
		isNewDevice ? "new_device_detected" : "new_location_detected",
		client.ip,
		client.userAgent,
		geo.country,
		geo.city,
		{ device: client.deviceName, location: formatLocation(geo) }
	);

	createNotification({
		userId: user.id,
		type: isNewDevice ? "new_device_login" : "new_location_login",
		title: isNewDevice ? "New device sign-in" : "New location sign-in",
		body: `Device: ${client.deviceName ?? "Unknown"}, Location: ${formatLocation(geo)}`,
	}).catch((err: unknown) => logger.error({ err }, "security notification failed"));
}
