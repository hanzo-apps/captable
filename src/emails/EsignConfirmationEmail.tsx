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

import type { TSchema } from "../jobs/esign-confirmation-email";

const ESignConfirmationEmail = ({
  documentName,
  recipient,
  senderName,
  company,
  fileUrl,
}: TSchema) => {
  return (
    <Html>
      <Head />
      <Preview>
        {senderName ?? ""} has sent you a confirmation email with completed
        signed document.
      </Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-[40px] max-w-[465px] border-separate rounded border border-solid border-neutral-200 p-[20px]">
            <Heading className="mx-0 mb-[15px] mt-5 p-0 text-center text-[24px] font-normal text-black">
              {company?.name}
            </Heading>

            <Text className="text-[14px] leading-[24px] text-black">
              Hello {recipient?.name} ,
            </Text>

            <Text className="mt-5 text-[14px] leading-[24px] text-black">
              All parties have completed and signed the document -{" "}
              <strong>{documentName}</strong>. The download link below works
              for 7 days.
            </Text>

            <Section className="mx-auto my-[32px] text-center">
              <Button
                className="rounded bg-black px-5 py-3 text-center text-[12px] font-semibold text-white no-underline"
                href={fileUrl}
              >
                Download the signed document
              </Button>
            </Section>

            <Text className="mt-[20px] !text-[14px] leading-[24px] text-black">
              - {senderName}
            </Text>

            <Hr className="mx-0 my-[26px] w-full border border-solid border-neutral-200" />
            <Text className="mx-auto text-center text-[12px] leading-[24px] text-[#666666]">
              Please ignore, if you were not expecting this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

ESignConfirmationEmail.PreviewProps = {
  fileUrl: "https://example.com/document.pdf",
  documentName: "Document Name",
  recipient: { name: "Recipient Name", email: "" },
  senderName: "Sender Name",
  company: { name: "Company Name" },
};

export default ESignConfirmationEmail;
