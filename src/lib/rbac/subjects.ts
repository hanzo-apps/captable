// What a role grants actions on. `securities` is the cap table itself — share
// classes, equity plans, shares, options, SAFEs and convertibles; `updates` is
// investor updates. A role saved before a subject existed holds nothing on it.
export const SUBJECTS = [
  "billing",
  "members",
  "stakeholder",
  "securities",
  "updates",
  "roles",
  "audits",
  "documents",
  "company",
  "developer",
  "bank-accounts",
] as const;
export type TSubjects = (typeof SUBJECTS)[number];
