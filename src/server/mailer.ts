import { captableApiBase } from "@/server/captable-api";

type Mail = { to: string; subject: string; html: string };

const IAM_URL = process.env.IAM_URL || "https://hanzo.id";

/** This app's own IAM identity, minted with the client-credentials grant. */
async function appToken(): Promise<string> {
  const basic = Buffer.from(
    `${process.env.IAM_CLIENT_ID}:${process.env.IAM_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch(`${IAM_URL}/v1/iam/oauth/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
  };
  if (!body.access_token) {
    throw new Error(`IAM token refused (${res.status}): ${body.error ?? ""}`);
  }
  return body.access_token;
}

/**
 * Delivers one email through Hanzo notify (POST /v1/notify/send/email). notify
 * sends with the email provider and sender address configured for this app's
 * org, so there is no SMTP server or from-address here.
 */
export async function sendMail({ to, subject, html }: Mail): Promise<void> {
  const res = await fetch(
    `${captableApiBase()}/v1/notify/send/email?sync=true`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${await appToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ to: [to], subject, body: html, sync: "true" }),
      cache: "no-store",
    },
  );
  const out = (await res.json().catch(() => ({}))) as {
    status?: string;
    error?: string;
    detail?: string;
  };
  if (!res.ok || out.status === "failed") {
    throw new Error(
      `notify did not send "${subject}" (${res.status}): ${out.error ?? out.detail ?? ""}`,
    );
  }
}
