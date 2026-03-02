"use client";

import { api } from "@/trpc/react";
import { InvestorDetailsForm } from "./form";
export { type TFormSchema } from "./form";

export function InvestorDetails() {
  const { data: stakeholders } = api.stakeholder.getStakeholders.useQuery();
  return <InvestorDetailsForm stakeholders={stakeholders ?? []} />;
}
