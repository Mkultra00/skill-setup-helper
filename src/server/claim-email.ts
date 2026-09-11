import type { Claim, Entitlement, Evidence } from "../lib/claimant-data";
export const CLAIM_EMAIL_VERSION = 2;
export function claimEmail(claim: Claim, entitlement: Entitlement, evidence: Evidence[]) {
  const subject = `${entitlement.demo ? "[DEMO] " : ""}Claim request — ${entitlement.title} — ${claim.typedName}`;
  const body = [
    ...(entitlement.demo
      ? ["DEMONSTRATION ONLY — Fictional claimant and supporting documents. Not a real claim.", ""]
      : []),
    "Dear Claims Administrator,",
    "",
    `I am writing to request consideration of my claim in connection with ${entitlement.title}. Please review the information below against the applicable claim requirements.`,
    "",
    "Claimant information",
    `Name: ${claim.typedName}`,
    "",
    "Basis of my claim",
    ...entitlement.predicates.map((p) => `• ${p.text}`),
    "",
    "Supporting documents for review",
    ...(evidence.length
      ? evidence.map((e) => `• ${e.name} — to be attached before sending`)
      : ["No supporting documents are included in this draft."]),
    "",
    "I have reviewed the statements above and confirm that they accurately reflect the information I provided. Please let me know if you require any additional documentation or if this request must be completed using a separate claim form or submission portal.",
    "",
    "Please acknowledge receipt and advise me of the next steps in the review process.",
    "",
    "Thank you for your time and consideration.",
    "",
    "Sincerely,",
    claim.typedName || "",
    "",
    "Preparation record",
    `Statement confirmed: ${claim.signedAt ? new Date(claim.signedAt).toUTCString() : "Not recorded"}`,
    `Packet reference: ${claim.packetHash}`,
    "",
    "DRAFT CHECKLIST — remove after review: Add the verified administrator email address; attach the documents listed above; confirm that email is an accepted submission method. This draft has not been submitted.",
  ].join("\n");
  return { subject, body };
}
