import { contentSecurityPolicy, servesPage } from "@/lib/csp";
import { loggedPath } from "@/lib/log-path";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { type NextRequest, userAgent } from "next/server";
import { env } from "./env";

const log = logger.child({ module: "middleware" });

const csp = contentSecurityPolicy({
  store: env.UPLOAD_ENDPOINT,
  iam: process.env.IAM_URL,
  sentry: env.NEXT_PUBLIC_SENTRY_DSN,
});

export function middleware(request: NextRequest) {
  if (env.LOGS || env.NODE_ENV === "production" || env.NODE_ENV === "staging") {
    const { method, nextUrl } = request;
    const time = new Date().toISOString();
    const { device, browser, isBot } = userAgent(request);

    log.info({
      method,
      time,
      path: loggedPath(nextUrl.pathname),
      device,
      browser,
      isBot,
    });
  }
  const response = NextResponse.next();
  if (servesPage(request.nextUrl.pathname)) {
    response.headers.set("Content-Security-Policy", csp);
  }
  return response;
}

export const config = {
  // Matcher ignores _next/static, _next/image, or favicon.ico
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
