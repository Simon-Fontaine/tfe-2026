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

interface SecurityAlertEmailProps {
  ip: string;
  location?: string;
  date: string;
}

export const SecurityAlertEmail = ({
  ip,
  location,
  date,
}: SecurityAlertEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Security Alert: New sign-in detected</Preview>
      <Tailwind>
        <Body className="bg-white font-sans text-gray-800 m-0 p-0">
          <Section className="bg-[#f48120] w-full">
            <Text className="m-0 p-0 leading-[4px] text-[4px]">&nbsp;</Text>
          </Section>

          <Container className="mx-auto p-6 max-w-[580px]">
            <Heading className="text-2xl font-bold text-gray-900 m-0 mb-4 mt-8">
              New sign-in detected
            </Heading>

            <Text className="text-[14px] leading-6 mb-6">
              A sign-in to your <strong>Scrimflow</strong> account was detected
              from a new device or location.
            </Text>

            <Section className="bg-gray-50 rounded-md p-4 mb-6 border border-gray-100">
              <div className="mb-3">
                <Text className="text-xs text-gray-500 uppercase font-semibold m-0 mb-1">
                  IP Address
                </Text>
                <Text className="text-sm font-mono text-gray-900 m-0">
                  {ip}
                </Text>
              </div>

              <div className="mb-3">
                <Text className="text-xs text-gray-500 uppercase font-semibold m-0 mb-1">
                  Location
                </Text>
                <Text className="text-sm text-gray-900 m-0">
                  {location || "Unknown"}
                </Text>
              </div>

              <div>
                <Text className="text-xs text-gray-500 uppercase font-semibold m-0 mb-1">
                  Date
                </Text>
                <Text className="text-sm text-gray-900 m-0">{date}</Text>
              </div>
            </Section>

            <Text className="text-[14px] leading-6">
              If this was you, you can ignore this email. If not, please{" "}
              <Link
                href="https://scrimflow.com/settings/security"
                className="text-[#f48120]"
                style={{ textDecoration: "underline" }}
              >
                secure your account
              </Link>{" "}
              immediately.
            </Text>

            <Hr className="border-gray-200 my-8" />

            <Text className="text-xs text-gray-400 m-0">
              This email was sent automatically to the address associated with
              your Scrimflow account. To stop receiving these alerts, manage
              your security preferences.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

SecurityAlertEmail.PreviewProps = {
  ip: "192.128.10.12",
  location: "Paris, France",
  date: "June 15, 2024 at 2:35 PM UTC",
} as SecurityAlertEmailProps;

export default SecurityAlertEmail;
