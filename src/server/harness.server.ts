import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { DEMO_ENTITLEMENTS, type Claim } from "../lib/claimant-data";
import {
  assertAttestation,
  assertSingleClaim,
  packetHash,
  signalBundle,
  canPromotePlaybook,
} from "./policy";
export function localChecks() {
  const e = structuredClone(DEMO_ENTITLEMENTS[0]!);
  e.deadline = "2099-01-01";
  const hash = packetHash(e, []);
  const claim: Claim = {
    id: randomUUID(),
    entitlementId: e.id,
    status: "ready_to_sign",
    evidenceIds: [],
    createdAt: new Date().toISOString(),
    packetHash: hash,
    typedName: null,
    signedAt: null,
    confirmation: null,
  };
  const valid = {
    typedName: "Jordan Example",
    packetHash: hash,
    checkboxes: e.predicates.map((p) => p.id),
  };
  const throws = (fn: () => unknown) => {
    try {
      fn();
      return false;
    } catch {
      return true;
    }
  };
  return {
    mode: "local",
    checks: [
      {
        name: "A complete, unchanged packet can be attested",
        passed: !throws(() => assertAttestation(claim, e, [], valid)),
      },
      {
        name: "Bulk operations fail closed",
        passed: throws(() => assertSingleClaim({ claimIds: ["a", "b"] })),
      },
      {
        name: "Missing individual confirmations block attestation",
        passed: throws(() => assertAttestation(claim, e, [], { ...valid, checkboxes: [] })),
      },
      {
        name: "Changed evidence fingerprint blocks attestation",
        passed: throws(() => assertAttestation(claim, e, [], { ...valid, packetHash: "tampered" })),
      },
      {
        name: "Repeated signatures are rejected",
        passed: throws(() => assertAttestation({ ...claim, status: "attested" }, e, [], valid)),
      },
      {
        name: "PII is excluded from research signals",
        passed: !JSON.stringify(
          signalBundle({ merchants: ["private@example.com", "Amazon"] }),
        ).includes("private@"),
      },
      {
        name: "Learning cannot promote lower attestation accuracy",
        passed: !canPromotePlaybook(10, 0.98, 0.9) && !canPromotePlaybook(4, 0.98, 0.99),
      },
    ],
  };
}
export async function daytonaChecks() {
  if (!process.env["DAYTONA_API_KEY"]) throw new Error("Daytona is not configured.");
  const python = process.env["CLAIMANT_PYTHON"] || resolve(".venv/bin/python");
  const { stdout } = await promisify(execFile)(
    python,
    [resolve("services/filer/daytona_harness.py")],
    { timeout: 180000, maxBuffer: 1024 * 1024, env: process.env },
  );
  return JSON.parse(stdout.trim().split("\n").at(-1)!) as {
    mode: string;
    checks: { name: string; passed: boolean }[];
    sandboxId: string;
  };
}
