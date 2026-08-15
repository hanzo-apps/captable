/**
 * The body `POST /v1/captable/safes` accepts. `type` and `status` are required
 * there and were never collected by either SAFE form — they came from the column
 * defaults while a SAFE was a local row, so they are stated here instead.
 *
 * The app-only fields (`safeId`, `safeTemplate`, `document`, `recipients`) are
 * deliberately absent: they describe this app's e-sign paperwork, not the SAFE.
 */
export interface SafeTerms {
  stakeholderId: string;
  capital: number;
  valuationCap: number;
  discountRate?: number;
  proRata: boolean;
  issueDate: string;
  boardApprovalDate: string;
}

export const safeBody = (publicId: string, terms: SafeTerms) => ({
  publicId,
  stakeholderId: terms.stakeholderId,
  type: "POST_MONEY",
  status: "DRAFT",
  capital: terms.capital,
  valuationCap: terms.valuationCap,
  discountRate: terms.discountRate,
  proRata: terms.proRata,
  issueDate: terms.issueDate,
  boardApprovalDate: terms.boardApprovalDate,
});
