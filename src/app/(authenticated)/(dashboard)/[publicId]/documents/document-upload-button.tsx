"use client";

import { pushModal } from "@/components/modals";
import { Button } from "@/components/ui/button";
import { RiAddFill } from "@remixicon/react";
import React from "react";

type DocumentUploadButtonProps = {
  buttonDisplayName: string;
};

export const DocumentUploadButton = ({
  buttonDisplayName,
}: DocumentUploadButtonProps) => {
  return (
    <Button
      onClick={() => {
        pushModal("DocumentUploadModal");
      }}
    >
      <RiAddFill className="mr-2 h-5 w-5" />
      {buttonDisplayName}
    </Button>
  );
};
