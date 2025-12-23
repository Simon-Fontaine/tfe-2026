import {
  Body,
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

interface VerificationEmailProps {
  code: string;
  title: string;
  message: string;
  actionText: string;
}

export const VerificationEmail = ({
  code,
  title,
  message,
  actionText,
}: VerificationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans text-gray-800 m-0 p-0">
          <Section className="bg-[#f48120] w-full">
            <Text className="m-0 p-0 leading-[4px] text-[4px]">&nbsp;</Text>
          </Section>

          <Container className="mx-auto p-6 max-w-[580px]">
            <Heading className="text-2xl font-bold text-gray-900 m-0 mb-4 mt-8">
              {title}
            </Heading>

            <Text className="text-[14px] leading-6 mb-2">{message}</Text>
            <Text className="text-[14px] leading-6 mb-6">
              To continue, please {actionText}:
            </Text>

            <Section className="mb-8">
              <Text className="font-mono text-3xl font-bold tracking-widest text-black bg-gray-100 px-6 py-4 rounded inline-block m-0 border border-gray-200">
                {code}
              </Text>
            </Section>

            <Text className="text-xs text-gray-500 mb-6">
              This code will expire in 15 minutes. Do not share it with anyone.
            </Text>

            <Hr className="border-gray-200 my-8" />

            <Text className="text-xs text-gray-400 m-0">
              If you didn't request this email, no action is required.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

VerificationEmail.PreviewProps = {
  code: "123456",
  title: "Verify your email address",
  message:
    "Use the code below to verify your email address and finish setting up your account.",
  actionText: "enter the following code",
} as VerificationEmailProps;

export default VerificationEmail;
