import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";

interface PasswordResetEmailProps {
	resetUrl: string;
}

export const PasswordResetEmail = ({ resetUrl }: PasswordResetEmailProps) => {
	return (
		<Html>
			<Head />
			<Preview>Reset your Scrimflow password</Preview>
			<Tailwind>
				<Body className="bg-white font-sans text-gray-800 m-0 p-0">
					<Section className="bg-[#f48120] w-full">
						<Text className="m-0 p-0 leading-1 text-[4px]">&nbsp;</Text>
					</Section>

					<Container className="mx-auto p-6 max-w-145">
						<Heading className="text-2xl font-bold text-gray-900 m-0 mb-4 mt-8">
							Reset your password
						</Heading>

						<Text className="text-[14px] leading-6 mb-2">
							We received a request to reset the password for your Scrimflow account.
						</Text>
						<Text className="text-[14px] leading-6 mb-6">
							Click the button below to choose a new password. This link expires in 1 hour.
						</Text>

						<Section className="mb-8">
							<Button
								href={resetUrl}
								className="bg-[#f48120] text-white font-semibold px-6 py-3 rounded-md text-sm"
							>
								Reset Password
							</Button>
						</Section>

						<Text className="text-xs text-gray-500 mb-6">
							Or copy and paste this link into your browser:{" "}
							<span className="font-mono break-all">{resetUrl}</span>
						</Text>

						<Hr className="border-gray-200 my-8" />

						<Text className="text-xs text-gray-400 m-0">
							If you didn't request a password reset, you can safely ignore this email. Your
							password will not be changed.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

PasswordResetEmail.PreviewProps = {
	resetUrl: "https://scrimflow.com/auth?reset_token=abc123",
} as PasswordResetEmailProps;

export default PasswordResetEmail;
