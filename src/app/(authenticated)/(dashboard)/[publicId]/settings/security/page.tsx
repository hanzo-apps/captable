import { SecurityList } from "@/components/security/SecurityList";
import { SettingsHeader } from "@/components/security/SettingHeader";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Security",
};

// Sign-in and its password are Hanzo's; nothing here holds one.
const SecurityLists = [
  {
    title: "Passkeys",
    description: "Add, delete or update passkey configuration.",
    href: "security/passkey",
    buttonDisplayName: "Manage passkeys",
  },
  {
    title: "Two factor authentication",
    description: "Add an extra layer of security to your account.",
    href: "security/2fa",
    buttonDisplayName: "Manage 2FA",
  },
];

export default async function SecurityPage() {
  return (
    <>
      <SettingsHeader
        title="Security"
        subtitle="Manage your security settings."
        showBackArrow={false}
      />
      {SecurityLists.map((security) => (
        <SecurityList
          key={security.href}
          title={security.title}
          description={security.description}
          href={security.href}
          buttonDisplayName={security.buttonDisplayName}
        />
      ))}
    </>
  );
}
