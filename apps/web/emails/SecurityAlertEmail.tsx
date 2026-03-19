import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Link,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";

export type SecurityAlertType =
	| "new_device"
	| "new_location"
	| "suspicious"
	| "password_changed"
	| "email_changed"
	| "two_factor_enabled"
	| "two_factor_disabled";

interface SecurityAlertEmailProps {
	ip: string;
	device: string;
	location: string;
	date: string;
	alertType: SecurityAlertType;
	twoFactorMethod?: "totp" | "passkey" | "security_key";
}

const TWO_FACTOR_METHOD_LABELS: Record<"totp" | "passkey" | "security_key", string> = {
	totp: "Authenticator app (TOTP)",
	passkey: "Passkey",
	security_key: "Security key",
};

function getTwoFactorBody(
	action: "enabled" | "disabled",
	method?: "totp" | "passkey" | "security_key"
): string {
	const methodLabel = method ? TWO_FACTOR_METHOD_LABELS[method] : null;
	const methodStr = methodLabel ? ` using ${methodLabel}` : "";
	if (action === "enabled") {
		return `Two-factor authentication (2FA)${methodStr} was recently enabled on your Scrimflow account.`;
	}
	return `Two-factor authentication (2FA)${methodStr} was recently disabled on your Scrimflow account. Your account may be less secure.`;
}

const ALERT_COPY: Record<
	SecurityAlertType,
	(method?: "totp" | "passkey" | "security_key") => { subject: string; body: string }
> = {
	new_device: () => ({
		subject: "New device sign-in",
		body: "A sign-in to your Scrimflow account was detected from a new device.",
	}),
	new_location: () => ({
		subject: "New location sign-in",
		body: "A sign-in to your Scrimflow account was detected from a new location.",
	}),
	suspicious: () => ({
		subject: "Suspicious sign-in attempt",
		body: "A suspicious sign-in attempt was detected on your Scrimflow account.",
	}),
	password_changed: () => ({
		subject: "Password changed",
		body: "The password for your Scrimflow account was recently changed.",
	}),
	email_changed: () => ({
		subject: "Email address changed",
		body: "The email address on your Scrimflow account was recently changed. If this wasn't you, please secure your account immediately.",
	}),
	two_factor_enabled: (method) => ({
		subject: "Two-factor authentication enabled",
		body: getTwoFactorBody("enabled", method),
	}),
	two_factor_disabled: (method) => ({
		subject: "Two-factor authentication disabled",
		body: getTwoFactorBody("disabled", method),
	}),
};

export const SecurityAlertEmail = ({
	ip,
	device,
	location,
	date,
	alertType,
	twoFactorMethod,
}: SecurityAlertEmailProps) => {
	const copy = ALERT_COPY[alertType](twoFactorMethod);

	return (
		<Html>
			<Head />
			<Preview>Security alert: {copy.subject}</Preview>
			<Tailwind>
				<Body className="m-0 bg-white p-0 font-sans text-gray-800">
					<Section className="w-full bg-[#f48120]">
						<Text className="m-0 p-0 text-[4px] leading-1">&nbsp;</Text>
					</Section>

					<Container className="mx-auto max-w-145 p-6">
						<Heading className="m-0 mb-4 mt-8 text-2xl font-bold text-gray-900">
							{copy.subject}
						</Heading>

						<Text className="mb-6 text-[14px] leading-6">
							{copy.body} If this was you, no action is needed. If you don't recognise this
							activity, please secure your account immediately.
						</Text>

						<Section className="mb-6 rounded-md border border-gray-100 bg-gray-50 p-4">
							<div className="mb-3">
								<Text className="m-0 mb-1 text-xs font-semibold uppercase text-gray-500">
									Device
								</Text>
								<Text className="m-0 text-sm text-gray-900">{device}</Text>
							</div>

							<div className="mb-3">
								<Text className="m-0 mb-1 text-xs font-semibold uppercase text-gray-500">
									IP Address
								</Text>
								<Text className="m-0 font-mono text-sm text-gray-900">{ip}</Text>
							</div>

							<div className="mb-3">
								<Text className="m-0 mb-1 text-xs font-semibold uppercase text-gray-500">
									Location
								</Text>
								<Text className="m-0 text-sm text-gray-900">{location}</Text>
							</div>

							<div>
								<Text className="m-0 mb-1 text-xs font-semibold uppercase text-gray-500">Date</Text>
								<Text className="m-0 text-sm text-gray-900">{date}</Text>
							</div>
						</Section>

						<Text className="text-[14px] leading-6">
							If this wasn't you, please{" "}
							<Link
								href="https://scrimflow.com/settings/security"
								className="text-[#f48120]"
								style={{ textDecoration: "underline" }}
							>
								secure your account
							</Link>{" "}
							immediately by changing your password and revoking any unfamiliar sessions.
						</Text>

						<Hr className="my-8 border-gray-200" />

						<Text className="m-0 text-xs text-gray-400">
							This email was sent automatically to the address associated with your Scrimflow
							account. To manage your security notification preferences, visit your account
							settings.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

SecurityAlertEmail.PreviewProps = {
	ip: "203.0.113.42",
	device: "Chrome on Windows",
	location: "Paris, France",
	date: "Saturday, 21 Feb 2026 14:35:00 UTC",
	alertType: "new_device",
} as SecurityAlertEmailProps;

export default SecurityAlertEmail;
