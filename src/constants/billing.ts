import { env } from "@/env";

export const BILLING_URL =
  env.NEXT_PUBLIC_BILLING_URL ?? "https://billing.hanzo.ai";

export const PAY_URL = env.NEXT_PUBLIC_PAY_URL ?? "https://pay.hanzo.ai";
