import { db } from "@/server/db";
import { EditorWrapper } from "./editor-wrapper";

async function getUpdate(publicId: string) {
  return await db.update.findFirstOrThrow({
    where: { publicId },
  });
}

const UpdatePage = async ({
  params: { publicId, updatePublicId },
}: {
  params: { publicId: string; updatePublicId: string };
}) => {
  if (updatePublicId === "new") {
    return <EditorWrapper companyPublicId={publicId} mode="new" />;
  }
  const update = await getUpdate(updatePublicId);

  return (
    <EditorWrapper companyPublicId={publicId} update={update} mode="edit" />
  );
};

export default UpdatePage;
