import { cn } from "@/lib/utils";

export const CaptableLogo = ({ className }: { className?: string }) => {
  return (
    <svg
      className={cn(className)}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Hanzo"
    >
      <title>Hanzo</title>
      <rect width="64" height="64" rx="8" fill="#18181B" />
      <g transform="translate(8, 8) scale(0.716)">
        <path d="M22.21 67V44.6369H0V67H22.21Z" fill="white" />
        <path
          d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z"
          fill="white"
        />
        <path d="M22.21 0H0V22.3184H22.21V0Z" fill="white" />
        <path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" fill="white" />
        <path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" fill="white" />
      </g>
    </svg>
  );
};
