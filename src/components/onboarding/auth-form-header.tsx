import { CaptableLogo } from "@/components/common/logo";
import { APP_NAME } from "@/lib/branding";

interface LoginFormHeaderProps {
  page?: string;
}

export function AuthFormHeader(_props: LoginFormHeaderProps) {
  return (
    <div className="flex flex-col gap-y-2 text-center">
      <div className="flex justify-center">
        <CaptableLogo className="mb-3 h-10 w-auto" />
      </div>

      <h1 className="mb-2 text-2xl font-semibold tracking-tight">
        Login to {APP_NAME}
      </h1>
    </div>
  );
}
