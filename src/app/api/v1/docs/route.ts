import { ApiReference } from "@scalar/nextjs-api-reference";

const config = {
  spec: {
    url: "/api/v1/schema",
  },
  metaData: {
    title: "Hanzo Captable API Docs",
    description: "Hanzo Captable API Docs",
  },
};

export const GET = ApiReference(config);
