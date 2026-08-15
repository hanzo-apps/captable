import { PageLayout } from "@/components/dashboard/page-layout";
import { buttonVariants } from "@/components/ui/button";
import { BILLING_URL, PAY_URL } from "@/constants/billing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing",
};

const BillingPage = () => {
  return (
    <PageLayout
      title="Billing"
      description="Subscriptions, invoices and payment methods live on your Hanzo account."
    >
      <div className="flex flex-wrap gap-3">
        <a
          className={buttonVariants()}
          href={BILLING_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          Manage billing
        </a>
        <a
          className={buttonVariants({ variant: "secondary" })}
          href={PAY_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          View plans
        </a>
      </div>
    </PageLayout>
  );
};

export default BillingPage;
