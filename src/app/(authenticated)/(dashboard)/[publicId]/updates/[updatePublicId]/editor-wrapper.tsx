"use client";

import type { Update } from "@prisma/client";
import dynamic from "next/dynamic";

const Editor = dynamic(
  () => import("../../../../../../components/update/editor"),
  { ssr: false },
);

export function EditorWrapper({
  companyPublicId,
  update,
  mode,
}: {
  companyPublicId: string;
  update?: Update;
  mode: "new" | "edit";
}) {
  return (
    <Editor companyPublicId={companyPublicId} update={update} mode={mode} />
  );
}
