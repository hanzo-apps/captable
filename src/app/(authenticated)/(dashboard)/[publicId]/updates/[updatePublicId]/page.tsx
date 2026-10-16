import { serverPermission } from "@/lib/rbac/access-control";
import { db } from "@/server/db";
import { notFound } from "next/navigation";
import { EditorWrapper } from "./editor-wrapper";

const UpdatePage = async ({
  params: { publicId, updatePublicId },
}: {
  params: { publicId: string; updatePublicId: string };
}) => {
  const isNew = updatePublicId === "new";
  const { membership, allowed } = await serverPermission(
    "updates",
    isNew ? "create" : "read",
  );
  if (!allowed) {
    return notFound();
  }
  if (isNew) {
    return <EditorWrapper companyPublicId={publicId} mode="new" />;
  }
  const update = await db.update.findFirst({
    where: { publicId: updatePublicId, companyId: membership.companyId },
  });
  if (!update) {
    return notFound();
  }

  return (
    <EditorWrapper companyPublicId={publicId} update={update} mode="edit" />
  );
};

export default UpdatePage;
