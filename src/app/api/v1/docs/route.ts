import { ApiReference } from "@scalar/nextjs-api-reference";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Hanzo Captable";

const config = {
  spec: {
    url: "/api/v1/schema",
  },
  metaData: {
    title: `${appName} API Docs`,
    description: `${appName} API Docs`,
  },
};

export const GET = ApiReference(config);
