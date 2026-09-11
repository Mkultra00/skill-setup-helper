import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DEMO_ENTITLEMENTS } from "../src/lib/claimant-data";
import { packetHash } from "../src/server/policy";
const root = await mkdtemp(join(tmpdir(), "claimant-tests-"));
process.env.CLAIMANT_DATA_DIR = root;
process.env.CLAIMANT_LOCAL_MODE = "true";
const { handleApi } = await import("../src/server/api.server");
const { mutate } = await import("../src/server/store.server");
const owner = randomUUID(),
  other = randomUUID(),
  claimId = randomUUID();
const e = { ...DEMO_ENTITLEMENTS[0]!, id: "live-test", demo: false, deadline: "2099-12-31" };
await mutate(owner, (s) => {
  s.entitlements = [e];
  s.claims = [
    {
      id: claimId,
      entitlementId: e.id,
      status: "ready_to_sign",
      evidenceIds: [],
      packetHash: packetHash(e, []),
      createdAt: new Date().toISOString(),
      typedName: null,
      signedAt: null,
      confirmation: null,
    },
  ];
});
function request(action: string, data: unknown, session = owner, origin = "http://127.0.0.1:3000") {
  return handleApi(
    new Request(`http://127.0.0.1:3000/api/claimant/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: `claimant_session=${session}`,
      },
      body: JSON.stringify(data),
    }),
  );
}
describe("BFF boundaries", () => {
  test("requires same-origin mutation", async () =>
    expect(
      (await request("preferences", { minimumPayout: 20 }, owner, "https://attacker.example"))
        .status,
    ).toBe(400));
  test("cannot read another workspace packet", async () =>
    expect((await request("packet", { claimId }, other)).status).toBe(400));
  test("cannot attest another workspace claim", async () =>
    expect(
      (
        await request(
          "attest",
          {
            claimId,
            typedName: "Jordan Example",
            packetHash: packetHash(e, []),
            checkboxes: e.predicates.map((p) => p.id),
          },
          other,
        )
      ).status,
    ).toBe(400));
  test("bulk claim input fails", async () =>
    expect((await request("attest", { claimIds: [claimId] })).status).toBe(400));
  test("unknown fields fail validation", async () =>
    expect((await request("preferences", { minimumPayout: 20, admin: true })).status).toBe(400));
  test("automatic send is unavailable", async () =>
    expect((await request("send", { claimId })).status).toBe(400));
  test("forged file signatures fail validation", async () =>
    expect(
      (
        await request("evidence", {
          name: "x.pdf",
          mime: "application/pdf",
          content: Buffer.from("not a PDF").toString("base64"),
        })
      ).status,
    ).toBe(400));
  test("valid signature records attested, never submitted", async () => {
    const r = await request("attest", {
      claimId,
      typedName: "Jordan Example",
      packetHash: packetHash(e, []),
      checkboxes: e.predicates.map((p) => p.id),
    });
    expect(r.status).toBe(200);
    const s = await r.json();
    expect(s.claims[0].status).toBe("attested");
    expect(s.claims[0].confirmation).toBeNull();
  });
  test("rejects repeat signature", async () =>
    expect(
      (
        await request("attest", {
          claimId,
          typedName: "Jordan Example",
          packetHash: packetHash(e, []),
          checkboxes: e.predicates.map((p) => p.id),
        })
      ).status,
    ).toBe(400));
  test("uploads are isolated and actually deleted", async () => {
    const r = await request("evidence", {
      name: "test.txt",
      mime: "text/plain",
      content: Buffer.from("Synthetic receipt").toString("base64"),
    });
    expect(r.status).toBe(200);
    const s = await r.json();
    const id = s.evidence[0].id;
    expect((await request("delete-evidence", { id }, other)).status).toBe(400);
    expect((await request("delete-evidence", { id })).status).toBe(200);
    const missing = await handleApi(
      new Request(`http://127.0.0.1:3000/api/claimant/evidence/${id}`, {
        headers: { Cookie: `claimant_session=${owner}` },
      }),
    );
    expect(missing.status).toBe(400);
  });
  test("public-host access is rejected", async () =>
    expect((await handleApi(new Request("https://public.example/api/claimant"))).status).toBe(403));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("Tax research consent and ownership", () => {
  test("requires explicit consent before provider access", async () => {
    expect(
      (
        await request("tax-research", {
          entitlementId: e.id,
          state: "New York",
          taxYear: 2026,
          consent: false,
        })
      ).status,
    ).toBe(400);
  });
  test("rejects unsupported state input before provider access", async () => {
    expect(
      (
        await request("tax-research", {
          entitlementId: e.id,
          state: "arbitrary prompt",
          taxYear: 2026,
          consent: true,
        })
      ).status,
    ).toBe(400);
  });
  test("cannot research another workspace opportunity", async () => {
    expect(
      (
        await request(
          "tax-research",
          { entitlementId: e.id, state: "New York", taxYear: 2026, consent: true },
          other,
        )
      ).status,
    ).toBe(400);
  });
});
