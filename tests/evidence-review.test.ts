import { describe, test, expect } from "bun:test";
import { reviewRequirement, packetHash, assertAttestation } from "../src/server/policy";
import { DEMO_ENTITLEMENTS, type Claim, type Evidence } from "../src/lib/claimant-data";
function fixture() {
  const e = structuredClone(DEMO_ENTITLEMENTS[0]!);
  e.deadline = null;
  e.proofRequired = true;
  e.classDefinition = "A receipt is required.";
  e.predicates = [
    {
      id: "purchase",
      text: "I have the receipt.",
      status: "unsupported",
      sourceQuote: e.classDefinition,
      reasoning: "Needs review",
      evidenceIds: [],
    },
  ];
  const docs: Evidence[] = [
    {
      id: "receipt",
      name: "sample.txt",
      kind: "text/plain",
      source: "test",
      sha256: "abc",
      size: 3,
      createdAt: "2026-01-01",
      demo: true,
    },
  ];
  const claim: Claim = {
    id: "test",
    entitlementId: e.id,
    status: "needs_evidence",
    evidenceIds: [],
    createdAt: "2026-01-01",
    packetHash: packetHash(e, []),
    typedName: null,
    signedAt: null,
    confirmation: null,
  };
  return { e, docs, claim };
}
describe("Evidence review transition", () => {
  test("review preserves separate attestation and binds review to hash", () => {
    const { e, docs, claim } = fixture();
    const before = claim.packetHash;
    reviewRequirement(claim, e, docs, {
      predicateId: "purchase",
      evidenceId: "receipt",
      note: "I checked the sample receipt and purchase date.",
    });
    expect(claim.status).toBe("ready_to_sign");
    expect(claim.signedAt).toBeNull();
    expect(claim.packetHash).not.toBe(before);
    assertAttestation(claim, e, docs, {
      typedName: "Jordan Example",
      checkboxes: ["purchase"],
      packetHash: claim.packetHash,
    });
    e.predicates[0]!.reasoning = "Changed review";
    expect(packetHash(e, docs)).not.toBe(claim.packetHash);
  });
  test("cannot resolve documentary requirement without owned evidence", () => {
    const { e, docs, claim } = fixture();
    expect(() =>
      reviewRequirement(claim, e, docs, {
        predicateId: "purchase",
        evidenceId: "another-owner",
        note: "I reviewed a document from another owner.",
      }),
    ).toThrow();
  });
  test("invented source quote cannot be manually cleared", () => {
    const { e, docs, claim } = fixture();
    e.predicates[0]!.sourceQuote = "Invented";
    expect(() =>
      reviewRequirement(claim, e, docs, {
        predicateId: "purchase",
        evidenceId: "receipt",
        note: "I checked the sample receipt and purchase date.",
      }),
    ).toThrow();
  });
  test("signed claim cannot be modified through review", () => {
    const { e, docs, claim } = fixture();
    claim.status = "attested";
    expect(() =>
      reviewRequirement(claim, e, docs, {
        predicateId: "purchase",
        evidenceId: "receipt",
        note: "I checked the sample receipt and purchase date.",
      }),
    ).toThrow();
  });
});
