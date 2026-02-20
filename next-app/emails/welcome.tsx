import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

interface WelcomeEmailProps {
	username: string;
}

export function WelcomeEmail({ username }: WelcomeEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>Welcome to Scrimflow, {username}!</Preview>
			<Body style={{ fontFamily: "sans-serif", backgroundColor: "#f4f4f4" }}>
				<Container
					style={{
						maxWidth: "600px",
						margin: "40px auto",
						backgroundColor: "#fff",
						padding: "32px",
						borderRadius: "8px",
					}}
				>
					<Heading>Welcome, {username}!</Heading>
					<Text>Thanks for joining Scrimflow. You're all set to get started.</Text>
				</Container>
			</Body>
		</Html>
	);
}
