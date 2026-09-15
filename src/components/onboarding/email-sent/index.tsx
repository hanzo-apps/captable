"use client";

import { Button } from "@/components/ui/button";
import { RiMailLine } from "@remixicon/react";
import Link from "next/link";

const EmailSent = () => {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="grid w-full max-w-md grid-cols-1 gap-5 rounded-xl border bg-card p-10 text-card-foreground shadow">
        <div className="flex flex-col gap-y-2 text-center">
          <RiMailLine className="mb-1 h-10 w-auto" />
          <h1 className="text-2xl font-semibold tracking-tight">Email sent!</h1>
        </div>
        <div className="text-center">
          A password reset email has been sent, if you have an account you
          should see it in your inbox shortly.
        </div>
        <Link href="/" className="mt-4 text-center">
          <Button size="lg">Back to login</Button>
        </Link>
      </div>
    </div>
  );
};
export default EmailSent;
