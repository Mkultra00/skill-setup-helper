import { createHash } from "node:crypto";
import type { Claim, Entitlement, Evidence } from "../lib/claimant-data";

export class PolicyError extends Error {}
export const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
/** Hash the exact assertions, source definition and ordered evidence identities, not only filenames. */
export function packetHash(entitlement: Entitlement, evidence: Evidence[]) {
  return digest(
    JSON.stringify({
      version: 1,
      entitlement: entitlement.id,
      definition: entitlement.classDefinition,
      assertions: entitlement.predicates.map((p) => ({
        id: p.id,
        text: p.text,
        status: p.status,
        sourceQuote: p.sourceQuote,
        reasoning: p.reasoning,
        evidenceIds: p.evidenceIds,
      })),
      evidence: evidence
        .map((e) => ({ id: e.id, hash: e.sha256 }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }),
  );
}
export function assertAttestation(
  claim: Claim,
  entitlement: Entitlement,
  evidence: Evidence[],
  input: { typedName: string; packetHash: string; checkboxes: string[] },
  now = new Date(),
) {
  if (claim.status !== "ready_to_sign")
    throw new PolicyError("This claim is not ready for attestation.");
  if (entitlement.deadline && new Date(`${entitlement.deadline}T23:59:59Z`) < now)
    throw new PolicyError("The published deadline has passed.");
  if (entitlement.predicates.some((p) => ["unsupported", "contradicted"].includes(p.status)))
    throw new PolicyError("Unresolved evidence requirements must be reviewed first.");
  if (evidence.length !== claim.evidenceIds.length)
    throw new PolicyError("An evidence document has changed or been deleted.");
  const currentHash = packetHash(entitlement, evidence);
  if (input.packetHash !== currentHash || claim.packetHash !== currentHash)
    throw new PolicyError("The packet changed. Review it again before signing.");
  if (input.typedName.trim().length < 3 || input.typedName.length > 120)
    throw new PolicyError("Enter your full name.");
  if (
    new Set(input.checkboxes).size !== entitlement.predicates.length ||
    entitlement.predicates.some((p) => !input.checkboxes.includes(p.id))
  )
    throw new PolicyError("Confirm every factual statement individually.");
}
export function assertSingleClaim(input: unknown) {
  if (
    Array.isArray(input) ||
    (input && typeof input === "object" && ("claimIds" in input || "claims" in input))
  )
    throw new PolicyError("Bulk claim operations are not supported.");
}
export function publicUrl(value: string): string | null {
  try {
    const u = new URL(value);
    const h = u.hostname.toLowerCase();
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      h === "localhost" ||
      h.endsWith(".local") ||
      h.endsWith(".internal") ||
      !h.includes(".") ||
      /^[\d.]+$/.test(h) ||
      h.includes(":")
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}
/** Closed vocabulary: raw names, emails, order IDs and free-form messages never enter research. */
export function signalBundle(input: { merchants?: string[]; states?: string[] }) {
  const allowedMerchants = [
    "Amazon",
    "Delta",
    "Ticketmaster",
    "Chase",
    "Fitbit",
    "Adobe",
    "Peloton",
  ];
  return {
    merchants: (input.merchants || []).filter((v) => allowedMerchants.includes(v)),
    states: (input.states || []).filter((v) => ["NY", "NJ", "CA", "TX", "FL"].includes(v)),
    purchase_years: [2020, 2021, 2022, 2023, 2024],
  };
}
export function canPromotePlaybook(
  observations: number,
  baselineAccuracy: number,
  nextAccuracy: number,
) {
  return (
    Number.isInteger(observations) &&
    observations >= 5 &&
    [baselineAccuracy, nextAccuracy].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
    nextAccuracy >= baselineAccuracy
  );
}

/** Human review records provenance; it does not claim automated evidence verification. */
export function reviewRequirement(
  claim: Claim,
  entitlement: Entitlement,
  evidence: Evidence[],
  input: { predicateId: string; evidenceId?: string | undefined; note: string },
) {
  if (claim.status !== "needs_evidence")
    throw new PolicyError("This claim is not awaiting evidence review.");
  const requirement = entitlement.predicates.find((p) => p.id === input.predicateId);
  if (!requirement || requirement.status === "contradicted")
    throw new PolicyError("This requirement cannot be resolved through manual review.");
  if (
    !requirement.sourceQuote.trim() ||
    !entitlement.classDefinition.includes(requirement.sourceQuote)
  )
    throw new PolicyError("The source quotation must be corrected by FILER before review.");
  const document = evidence.find((e) => e.id === input.evidenceId);
  if (input.evidenceId && !document)
    throw new PolicyError("The evidence is not in this workspace.");
  if (entitlement.proofRequired && !document)
    throw new PolicyError("Select the document you reviewed for this requirement.");
  if (input.note.trim().length < 20)
    throw new PolicyError("Explain what you reviewed and how it supports this requirement.");
  requirement.evidenceIds = document ? [document.id] : [];
  requirement.reasoning = `User-reviewed; not independently verified: ${input.note.trim()}`;
  requirement.status = "user_assertion_required";
  claim.evidenceIds = [...new Set(entitlement.predicates.flatMap((p) => p.evidenceIds))];
  claim.packetHash = packetHash(
    entitlement,
    evidence.filter((e) => claim.evidenceIds.includes(e.id)),
  );
  claim.status = entitlement.predicates.some((p) =>
    ["unsupported", "contradicted"].includes(p.status),
  )
    ? "needs_evidence"
    : "ready_to_sign";
}
