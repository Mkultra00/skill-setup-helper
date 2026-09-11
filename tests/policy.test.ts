import { describe, expect, test } from "bun:test";
import { DEMO_ENTITLEMENTS, type Claim } from "../src/lib/claimant-data";
import {
  assertAttestation,
  assertSingleClaim,
  packetHash,
  publicUrl,
  signalBundle,
  canPromotePlaybook,
} from "../src/server/policy";
const entitlement = { ...DEMO_ENTITLEMENTS[0]!, deadline: "2099-12-31" };
const hash = packetHash(entitlement, []);
const claim: Claim = {
  id: "test",
  entitlementId: entitlement.id,
  status: "ready_to_sign",
  evidenceIds: [],
  createdAt: "2026-09-11",
  packetHash: hash,
  typedName: null,
  signedAt: null,
  confirmation: null,
};
const input = {
  typedName: "Jordan Example",
  packetHash: hash,
  checkboxes: entitlement.predicates.map((p) => p.id),
};
describe("Attestation boundary", () => {
  test("permits an individually confirmed, unchanged packet", () =>
    expect(() => assertAttestation(claim, entitlement, [], input)).not.toThrow());
  test("does not mutate state or imply submission", () => {
    assertAttestation(claim, entitlement, [], input);
    expect(claim.status).toBe("ready_to_sign");
  });
  test.each(["analyzing", "needs_evidence", "parked", "attested", "submitted"] as const)(
    "rejects %s state",
    (status) =>
      expect(() => assertAttestation({ ...claim, status }, entitlement, [], input)).toThrow(),
  );
  test("requires every checkbox", () =>
    expect(() =>
      assertAttestation(claim, entitlement, [], {
        ...input,
        checkboxes: input.checkboxes.slice(1),
      }),
    ).toThrow());
  test("rejects duplicate confirmations", () =>
    expect(() =>
      assertAttestation(claim, entitlement, [], { ...input, checkboxes: Array(3).fill("account") }),
    ).toThrow());
  test("binds source changes into the fingerprint", () =>
    expect(() =>
      assertAttestation(claim, { ...entitlement, classDefinition: "changed" }, [], input),
    ).toThrow());
  test("binds assertion changes into the fingerprint", () =>
    expect(() =>
      assertAttestation(
        claim,
        {
          ...entitlement,
          predicates: entitlement.predicates.map((p) => ({ ...p, text: "changed" })),
        },
        [],
        input,
      ),
    ).toThrow());
  test("rejects stale client fingerprints", () =>
    expect(() =>
      assertAttestation(claim, entitlement, [], { ...input, packetHash: "stale" }),
    ).toThrow());
  test("rejects missing evidence", () =>
    expect(() =>
      assertAttestation({ ...claim, evidenceIds: ["deleted"] }, entitlement, [], input),
    ).toThrow());
  test("rejects documentary gaps", () =>
    expect(() =>
      assertAttestation(
        claim,
        { ...entitlement, predicates: [{ ...entitlement.predicates[0]!, status: "unsupported" }] },
        [],
        input,
      ),
    ).toThrow());
  test("rejects expired opportunity", () =>
    expect(() =>
      assertAttestation(claim, { ...entitlement, deadline: "2020-01-01" }, [], input),
    ).toThrow());
  test("rejects missing signature", () =>
    expect(() =>
      assertAttestation(claim, entitlement, [], { ...input, typedName: " " }),
    ).toThrow());
});
describe("Privacy and safe outputs", () => {
  test.each([{ value: [] }, { value: { claims: ["a"] } }, { value: { claimIds: ["a", "b"] } }])(
    "rejects bulk shape",
    ({ value }) => expect(() => assertSingleClaim(value)).toThrow(),
  );
  test("whitelist serialization excludes PII", () =>
    expect(
      signalBundle({
        merchants: ["Amazon", "jane@example.com", "1234-5678"],
        states: ["NY", "Jane Doe"],
      }),
    ).toEqual({
      merchants: ["Amazon"],
      states: ["NY"],
      purchase_years: [2020, 2021, 2022, 2023, 2024],
    }));
  test.each([
    "javascript:alert(1)",
    "http://example.com",
    "https://127.0.0.1",
    "https://169.254.169.254",
    "https://localhost",
    "https://x.internal",
    "https://user:pass@example.com",
    "https://example.com:8443",
  ])("blocks unsafe URL %s", (url) => expect(publicUrl(url)).toBeNull());
  test("permits ordinary public HTTPS links", () =>
    expect(publicUrl("https://www.ftc.gov/refunds")).toBe("https://www.ftc.gov/refunds"));
  test("learning requires enough observations and no accuracy regression", () => {
    expect(canPromotePlaybook(4, 0.95, 0.98)).toBe(false);
    expect(canPromotePlaybook(5, 0.95, 0.94)).toBe(false);
    expect(canPromotePlaybook(5, 0.95, 0.96)).toBe(true);
    expect(canPromotePlaybook(5, 0.95, NaN)).toBe(false);
  });
});
