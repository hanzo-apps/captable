import MemberInviteEmail from "@/emails/MemberInviteEmail";
import { env } from "@/env";
import { constants } from "@/lib/constants";
import { sendMail } from "@/server/mailer";
import { render } from "@react-email/components";
import { z } from "zod";
import { defineJob, defineWorker, defineWorkerConfig } from "../lib/queue";

const config = defineWorkerConfig({
  name: "email.member-invite",
  schema: z.object({
    email: z.string(),
    user: z.object({
      email: z.string().email().nullish(),
      name: z.string().nullish(),
    }),
    verificationToken: z.string(),
    company: z.object({
      name: z.string(),
      id: z.string(),
    }),
  }),
});

export const sendMemberInviteEmailJob = defineJob(config);
export const sendMemberInviteEmailWorker = defineWorker(config, async (job) => {
  const { email, verificationToken, company, user } = job.data;

  const baseUrl = env.NEXT_PUBLIC_BASE_URL;

  // The link is the invitation's secret, so it goes in the mail and nowhere else.
  const inviteLink = `${baseUrl}/verify-member/${verificationToken}`;
  console.log("sending invite email to", email);

  await sendMail({
    to: email,
    subject: `Join ${company.name} on ${constants.title}`,
    html: await render(
      MemberInviteEmail({
        inviteLink,
        companyName: company.name,
        invitedBy: `${user.name || user.email}`,
      }),
    ),
  });
});
