import { APP_DESCRIPTION, APP_NAME } from "@/lib/branding";

export const constants = {
  title: APP_NAME,
  url: process.env.NEXT_PUBLIC_APP_URL || "https://captable.hanzo.ai",
  description: APP_DESCRIPTION,
  twitter: {
    url: "https://twitter.com/captableinc",
  },
  github: {
    url: "https://github.com/hanzoai/captable",
  },
  discord: {
    url: "https://discord.gg/xs8Qu4yrTT",
  },
  ocf: {
    url: "https://www.opencaptablecoalition.com/format",
    github: {
      url: "https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF",
    },
  },
};

export enum PayloadType {
  PROFILE_DATA = "profile-data",
  PROFILE_AVATAR = "profile-avatar",
}
