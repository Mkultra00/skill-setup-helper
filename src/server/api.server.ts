import { researchTax } from "./tax.server";
import { TAX_STATES } from "../lib/tax";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { DEMO_ENTITLEMENTS, type Workspace, type TrackId } from "../lib/claimant-data";
import { privateRoot, readWorkspace, mutate, event, initialWorkspace } from "./store.server";
import { assertAttestation, assertSingleClaim, digest, packetHash, PolicyError } from "./policy";
import { research } from "./scout.server";
import { emailDraft } from "./conduit";
import { claimEmail, CLAIM_EMAIL_VERSION } from "./claim-email";
import { createGmailDraft } from "./one.server";
import { reviewRequirement } from "./policy";
import { prepareClaim } from "./filer.server";
import { localChecks, daytonaChecks } from "./harness.server";

const uuid = z.string().uuid();
const id = z.string().min(1).max(100);
const requests = new Map<string, { start: number; count: number }>();
function rateLimit(session: string) {
  const now = Date.now();
  for (const [key, value] of requests) if (now - value.start > 60000) requests.delete(key);
  const entry = requests.get(session) || { start: now, count: 0 };
  entry.count++;
  requests.set(session, entry);
  if (entry.count > 80) throw new PolicyError("Too many requests. Please wait a minute.");
}
async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new PolicyError("JSON content is required.");
  const reader = request.body?.getReader();
  if (!reader) return {};
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 7 * 1024 * 1024) {
      await reader.cancel();
      throw new PolicyError("Request exceeds 7 MB.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new PolicyError("Invalid JSON.");
  }
}
function ownedClaim(state: Workspace, claimId: string) {
  const c = state.claims.find((c) => c.id === claimId);
  if (!c) throw new PolicyError("Claim not found in this workspace.");
  return c;
}
function entitlement(state: Workspace, entitlementId: string) {
  const e = state.entitlements.find((e) => e.id === entitlementId);
  if (!e) throw new PolicyError("Opportunity not found.");
  return e;
}
async function runScout(session: string, runId: string, mode: "live" | "demo") {
  const progress = async (message: string) => {
    await mutate(session, (state) => {
      if (state.run?.id === runId) {
        state.run.events.push(message);
        event(state, "SCOUT", message);
      }
    });
  };
  try {
    const results: Workspace["entitlements"] = [];
    let completedTracks = 0;
    // Four parallel category searches per track; tracks run sequentially to limit provider load.
    for (const track of ["class_action", "redemption", "coupon"] as const) {
      const current = await readWorkspace(session);
      if (current.run?.id !== runId || !current.researchConsent) return;
      await progress(
        `Starting ${track === "class_action" ? "Class actions" : track === "redemption" ? "Rebates & redemptions" : "Coupons & deals"}.`,
      );
      try {
        results.push(...(await research(track, progress)));
        completedTracks++;
      } catch {
        await progress(`${track}: research failed; continuing with the other tracks.`);
      }
    }
    if (!completedTracks) throw new Error("All discovery tracks failed. Please retry.");
    await mutate(session, (state) => {
      if (state.run?.id !== runId || state.run.status !== "running") return;
      if (mode === "live" && !state.researchConsent) {
        state.run.status = "failed";
        state.run.error = "Research consent was revoked. Results were discarded.";
        return;
      }
      const existingUrls = new Set(state.entitlements.map((e) => e.officialUrl).filter(Boolean));
      const filtered = results.filter(
        (e) =>
          !state.dismissed.includes(e.id) &&
          e.payoutHigh >= state.minimumPayout &&
          !existingUrls.has(e.officialUrl),
      );
      const existingIds = new Set(state.entitlements.map((e) => e.id));
      state.entitlements.unshift(...filtered.filter((e) => !existingIds.has(e.id)));
      state.run.status = "completed";
      state.run.events.push(
        `${filtered.length} ${mode === "demo" ? "sample" : "live"} opportunities reviewed. Eligibility remains unverified.`,
      );
      event(state, "SCOUT", "Discovery completed with source and privacy checks.");
    });
  } catch (error) {
    await mutate(session, (state) => {
      if (state.run?.id === runId) {
        state.run.status = "failed";
        state.run.error =
          error instanceof z.ZodError
            ? "The provider response did not match the required schema."
            : (error as Error).message;
      }
    });
  }
}

async function runFiler(session: string, claimId: string) {
  try {
    const before = await readWorkspace(session);
    const c = ownedClaim(before, claimId);
    const e = entitlement(before, c.entitlementId);
    const result = await prepareClaim(e);
    await mutate(session, (state) => {
      const current = state.claims.find((c) => c.id === claimId);
      if (!current || current.status !== "analyzing") return;
      const item = entitlement(state, current.entitlementId);
      item.predicates = result.predicates;
      current.status = item.predicates.some((p) => p.status === "unsupported")
        ? "needs_evidence"
        : "ready_to_sign";
      current.packetHash = packetHash(item, []);
      current.preparationEvents = result.events;
      for (const message of result.events) event(state, "FILER", message);
    });
  } catch (error) {
    await mutate(session, (state) => {
      const c = state.claims.find((c) => c.id === claimId);
      if (c) {
        c.status = "needs_evidence";
        c.preparationEvents = [(error as Error).message];
        event(state, "FILER", "Preparation could not complete. Claim remains blocked.");
      }
    });
  }
}

/** Development BFF. Production refuses to start without the explicit local-mode flag. */
export async function handleApi(request: Request): Promise<Response> {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  try {
    if (process.env["CLAIMANT_LOCAL_MODE"] !== "true")
      return new Response(
        JSON.stringify({
          error:
            "Local workspace mode is disabled. Configure authenticated production storage before deployment.",
        }),
        { status: 503, headers },
      );
    const url = new URL(request.url);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      return new Response(
        JSON.stringify({ error: "This development workspace accepts loopback access only." }),
        { status: 403, headers },
      );
    const cookie = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)claimant_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
    const session = cookie && uuid.safeParse(cookie).success ? cookie : randomUUID();
    if (!cookie)
      headers.set(
        "Set-Cookie",
        `claimant_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${url.protocol === "https:" ? "; Secure" : ""}`,
      );
    const action = url.pathname.replace("/api/claimant", "").replace(/^\//, "");
    if (request.method === "GET") {
      const state = await readWorkspace(session);
      if (action.startsWith("evidence/")) {
        const evidenceId = uuid.parse(action.slice(9));
        const file = state.evidence.find((e) => e.id === evidenceId);
        if (!file) throw new PolicyError("Document not found.");
        const bytes = await readFile(join(privateRoot, session, "files", evidenceId));
        headers.set("Content-Type", "application/octet-stream");
        headers.set(
          "Content-Disposition",
          `attachment; filename="${file.name.replace(/[^a-zA-Z0-9._ -]/g, "_")}"`,
        );
        return new Response(bytes, { headers });
      }
      if (action === "export")
        headers.set("Content-Disposition", 'attachment; filename="claimant-workspace.json"');
      else if (action !== "")
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
      return new Response(JSON.stringify(state), { headers });
    }
    if (request.method !== "POST")
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers,
      });
    if (request.headers.get("origin") !== url.origin)
      throw new PolicyError("A same-origin request is required.");
    rateLimit(session);
    const input = await body(request);
    assertSingleClaim(input);
    if (action === "sandbox") {
      const { mode } = z
        .object({ mode: z.enum(["local", "daytona"]) })
        .strict()
        .parse(input);
      return new Response(
        JSON.stringify(mode === "local" ? localChecks() : await daytonaChecks()),
        { headers },
      );
    }
    if (action === "tax-research") {
      const value = z
        .object({
          entitlementId: id,
          state: z.string().refine((v) => TAX_STATES.includes(v)),
          taxYear: z
            .number()
            .int()
            .min(2020)
            .max(new Date().getUTCFullYear() + 1),
          consent: z.literal(true),
        })
        .strict()
        .parse(input);
      const current = await readWorkspace(session);
      const item = entitlement(current, value.entitlementId);
      const report = await researchTax(item, value.state, value.taxYear);
      await mutate(session, (s) => {
        event(
          s,
          "SCOUT",
          `Researched federal and ${value.state} tax sources for ${value.taxYear}. No eligibility or attestation changed.`,
        );
      });
      return new Response(JSON.stringify(report), { headers });
    }
    let filerJob: string | null = null;
    let job: { runId: string; mode: "live" | "demo" } | null = null;
    const result = await mutate(session, async (state) => {
      switch (action) {
        case "start-demo": {
          z.object({}).strict().parse(input);
          const caseId = `guided-demo-${randomUUID()}`,
            claimId = randomUUID(),
            evidenceId = randomUUID();
          const definition =
            "The fictional claimant purchased an Example Audio headset between January 1 and December 31, 2025. A receipt showing the purchase is required.";
          const receipt =
            "FICTIONAL DEMO RECEIPT — NOT VALID FOR ANY REAL CLAIM\nCustomer: Jordan Example\nMerchant: Example Audio\nProduct: Headset\nPurchase date: June 15, 2025\nAmount paid: $120\n";
          await mkdir(join(privateRoot, session, "files"), { recursive: true, mode: 0o700 });
          await writeFile(join(privateRoot, session, "files", evidenceId), receipt, {
            mode: 0o600,
          });
          state.evidence.unshift({
            id: evidenceId,
            name: "FICTIONAL-demo-receipt.txt",
            kind: "text/plain",
            source: "Guided demo fixture",
            sha256: digest(receipt),
            size: Buffer.byteLength(receipt),
            createdAt: new Date().toISOString(),
            demo: true,
          });
          const item = {
            ...structuredClone(DEMO_ENTITLEMENTS[0]!),
            id: caseId,
            title: "Example Audio — fictional demo case",
            merchant: "Example Audio",
            administrator: "Fictional administrator",
            category: "GUIDED DEMO",
            summary:
              "A fictional $25 refund to demonstrate evidence review and attestation. Not a real settlement.",
            whyYou: "Scripted demo persona: Jordan Example purchased a headset in June 2025.",
            classDefinition: definition,
            proofRequired: true,
            deadline: null,
            officialUrl: null,
            sources: [],
            payoutLow: 25,
            payoutHigh: 25,
            demo: true,
            predicates: [
              {
                id: "demo-purchase",
                text: "I purchased an Example Audio headset during 2025 and reviewed the receipt.",
                sourceQuote: definition,
                status: "unsupported" as const,
                reasoning: "Sample receipt must be reviewed before practice attestation.",
                evidenceIds: [],
              },
            ],
          };
          state.entitlements.unshift(item);
          state.claims.unshift({
            id: claimId,
            entitlementId: caseId,
            status: "needs_evidence",
            evidenceIds: [],
            packetHash: packetHash(item, []),
            createdAt: new Date().toISOString(),
            typedName: null,
            signedAt: null,
            confirmation: null,
            preparationEvents: [
              "Guided demo: fictional case and sample receipt. Preparation is scripted; live discovery uses You.com and live preparation uses CrewAI.",
            ],
          });
          event(
            state,
            "YOU",
            "Started a fictional guided demo. No real eligibility or submission implied.",
          );
          break;
        }
        case "scout": {
          const value = z
            .object({
              track: z.enum(["class_action", "redemption", "coupon"]).optional(),
              mode: z.literal("live"),
              consent: z.boolean(),
            })
            .strict()
            .parse(input);
          if (state.run?.status === "running")
            throw new PolicyError("A discovery is already running.");
          if (value.mode === "live" && (!state.integrations.you || !value.consent))
            throw new PolicyError("Live discovery requires a configured key and your consent.");
          state.researchConsent = value.mode === "live" ? true : state.researchConsent;
          const runId = randomUUID();
          state.run = {
            id: runId,
            status: "running",
            mode: value.mode,
            events: ["Discovery queued. Personal documents will not be shared."],
            error: null,
          };
          job = { runId, mode: value.mode };
          break;
        }
        case "save": {
          const { id: entitlementId } = z.object({ id }).strict().parse(input);
          entitlement(state, entitlementId);
          state.saved = state.saved.includes(entitlementId)
            ? state.saved.filter((v) => v !== entitlementId)
            : [...state.saved, entitlementId];
          break;
        }
        case "dismiss": {
          const { id: entitlementId } = z.object({ id }).strict().parse(input);
          const e = entitlement(state, entitlementId);
          if (!state.dismissed.includes(entitlementId)) state.dismissed.push(entitlementId);
          state.memories.unshift({
            id: `dismiss:${entitlementId}`,
            kind: "rejection",
            content: `Exclude ${e.title} from future discovery.`,
            createdAt: new Date().toISOString(),
          });
          event(state, "YOU", `Dismissed ${e.title}.`);
          break;
        }
        case "preferences": {
          const { minimumPayout } = z
            .object({ minimumPayout: z.number().finite().min(0).max(10000) })
            .strict()
            .parse(input);
          state.minimumPayout = minimumPayout;
          state.memories = state.memories.filter((m) => m.id !== "minimum");
          state.memories.unshift({
            id: "minimum",
            kind: "preference",
            content: `Only show opportunities with a maximum estimate of at least $${minimumPayout}.`,
            createdAt: new Date().toISOString(),
          });
          event(state, "YOU", "Updated discovery preferences.");
          break;
        }
        case "forget": {
          const { id: memoryId } = z.object({ id }).strict().parse(input);
          state.memories = state.memories.filter((m) => m.id !== memoryId);
          if (memoryId === "minimum") state.minimumPayout = 0;
          if (memoryId.startsWith("dismiss:"))
            state.dismissed = state.dismissed.filter((v) => v !== memoryId.slice(8));
          break;
        }
        case "clear-memory": {
          state.memories = [];
          state.dismissed = [];
          state.minimumPayout = 0;
          event(state, "YOU", "Cleared preferences and dismissed-match memory.");
          break;
        }
        case "revoke-consent": {
          state.researchConsent = false;
          event(state, "YOU", "Revoked future research consent.");
          break;
        }
        case "claims": {
          const { entitlementId } = z.object({ entitlementId: id }).strict().parse(input);
          const e = entitlement(state, entitlementId);
          if (state.claims.some((c) => c.entitlementId === e.id)) break;
          if (!state.integrations.crewai) throw new PolicyError("CrewAI FILER is not connected.");
          const claimId = randomUUID();
          filerJob = claimId;
          state.claims.unshift({
            id: claimId,
            entitlementId: e.id,
            status: "analyzing",
            evidenceIds: [],
            createdAt: new Date().toISOString(),
            packetHash: packetHash(e, []),
            typedName: null,
            signedAt: null,
            confirmation: null,
          });
          event(
            state,
            "FILER",
            `Prepared ${e.demo ? "sample" : "source"} requirements for ${e.title}. No submission performed.`,
          );
          break;
        }
        case "review-requirement": {
          const value = z
            .object({
              claimId: uuid,
              predicateId: id,
              evidenceId: uuid.optional(),
              note: z.string().trim().min(20).max(2000),
            })
            .strict()
            .parse(input);
          const c = ownedClaim(state, value.claimId);
          reviewRequirement(c, entitlement(state, c.entitlementId), state.evidence, value);
          event(
            state,
            "YOU",
            "Recorded a human evidence review. Final individual attestation is still required.",
          );
          break;
        }
        case "retry-analysis": {
          const { claimId } = z.object({ claimId: uuid }).strict().parse(input);
          const c = ownedClaim(state, claimId);
          if (c.status !== "needs_evidence")
            throw new PolicyError("Only a blocked analysis can be retried.");
          c.status = "analyzing";
          c.evidenceIds = [];
          filerJob = claimId;
          break;
        }
        case "claim-state": {
          const value = z
            .object({ claimId: uuid, status: z.enum(["parked", "resume"]) })
            .strict()
            .parse(input);
          const c = ownedClaim(state, value.claimId);
          if (!["needs_evidence", "ready_to_sign", "parked"].includes(c.status))
            throw new PolicyError(
              "An attested claim cannot return to preparation through this action.",
            );
          const e = entitlement(state, c.entitlementId);
          c.status =
            value.status === "parked"
              ? "parked"
              : e.predicates.some((p) => ["unsupported", "contradicted"].includes(p.status))
                ? "needs_evidence"
                : "ready_to_sign";
          event(
            state,
            "YOU",
            value.status === "parked" ? "Saved claim without attesting." : "Resumed claim review.",
          );
          break;
        }
        case "attest": {
          const value = z
            .object({
              claimId: uuid,
              typedName: z.string(),
              packetHash: z.string(),
              checkboxes: z.array(z.string()).max(50),
            })
            .strict()
            .parse(input);
          const c = ownedClaim(state, value.claimId);
          const e = entitlement(state, c.entitlementId);
          assertAttestation(
            c,
            e,
            state.evidence.filter((v) => c.evidenceIds.includes(v.id)),
            value,
          );
          c.typedName = value.typedName.trim();
          c.signedAt = new Date().toISOString();
          c.status = "attested";
          event(
            state,
            "YOU",
            `Attested to packet ${c.packetHash.slice(0, 12)}. Nothing submitted.`,
          );
          break;
        }
        case "record-submission": {
          const value = z
            .object({ claimId: uuid, confirmation: z.string().trim().min(3).max(120) })
            .strict()
            .parse(input);
          const c = ownedClaim(state, value.claimId);
          if (c.status !== "attested" || entitlement(state, c.entitlementId).demo)
            throw new PolicyError(
              "Only an attested, non-demo claim can have a submission recorded.",
            );
          c.status = "submitted";
          c.confirmation = value.confirmation;
          event(
            state,
            "YOU",
            "Recorded a user-reported submission; administrator acceptance is unverified.",
          );
          break;
        }
        case "gmail-draft":
        case "email-draft": {
          const { claimId } = z.object({ claimId: uuid }).strict().parse(input);
          const c = ownedClaim(state, claimId);
          if (c.status !== "attested")
            throw new PolicyError("Attest to the exact packet before creating an email draft.");
          const e = entitlement(state, c.entitlementId);
          const email = claimEmail(
            c,
            e,
            state.evidence.filter((item) => c.evidenceIds.includes(item.id)),
          );
          if (action === "gmail-draft") {
            if (
              c.packetHash !==
              packetHash(
                e,
                state.evidence.filter((item) => c.evidenceIds.includes(item.id)),
              )
            )
              throw new PolicyError(
                "The attested packet changed. Review it again before drafting.",
              );
            if (c.gmailDraftId && c.gmailDraftVersion === CLAIM_EMAIL_VERSION)
              return { draftId: c.gmailDraftId, reviewUrl: "https://mail.google.com/mail/#drafts" };
            const draft = await createGmailDraft(email.subject, email.body);
            c.gmailDraftId = draft.draftId;
            c.gmailDraftVersion = CLAIM_EMAIL_VERSION;
            event(
              state,
              "CONDUIT",
              "Created an unsent Gmail draft through One. Recipient and attachments require user review.",
            );
            return draft;
          }
          event(
            state,
            "CONDUIT",
            "Prepared an unsent email file for the user's review. No mailbox accessed.",
          );
          return {
            filename: `claimant-${c.id}.eml`,
            content: emailDraft(email.subject, email.body),
          };
        }
        case "packet": {
          const { claimId } = z.object({ claimId: uuid }).strict().parse(input);
          const c = ownedClaim(state, claimId);
          return {
            version: 1,
            claim: c,
            entitlement: entitlement(state, c.entitlementId),
            evidence: state.evidence.filter((e) => c.evidenceIds.includes(e.id)),
            notice:
              "Preparation packet only. No submission or administrator acceptance is implied.",
          };
        }
        case "evidence": {
          const value = z
            .object({
              name: z.string().min(1).max(180),
              content: z
                .string()
                .max(7 * 1024 * 1024)
                .regex(/^[A-Za-z0-9+/]*={0,2}$/),
              mime: z.enum(["application/pdf", "text/plain", "image/png", "image/jpeg"]),
            })
            .strict()
            .parse(input);
          const bytes = Buffer.from(value.content, "base64");
          if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024)
            throw new PolicyError("File must be between 1 byte and 5 MB.");
          const header = bytes.subarray(0, 8);
          if (
            (value.mime === "application/pdf" && !header.toString().startsWith("%PDF-")) ||
            (value.mime === "image/png" &&
              !header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
            (value.mime === "image/jpeg" &&
              !(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)) ||
            (value.mime === "text/plain" && bytes.includes(0))
          )
            throw new PolicyError("File content does not match its declared type.");
          if (state.evidence.reduce((n, e) => n + e.size, 0) + bytes.length > 50 * 1024 * 1024)
            throw new PolicyError("Workspace upload limit is 50 MB.");
          const evidenceId = randomUUID();
          await mkdir(join(privateRoot, session, "files"), { recursive: true, mode: 0o700 });
          await writeFile(join(privateRoot, session, "files", evidenceId), bytes, { mode: 0o600 });
          state.evidence.push({
            id: evidenceId,
            name: value.name,
            kind: value.mime,
            source: "Uploaded by you",
            sha256: digest(bytes),
            size: bytes.length,
            createdAt: new Date().toISOString(),
            demo: false,
          });
          event(
            state,
            "CONDUIT",
            "Stored an uploaded document with content fingerprint; eligibility not inferred.",
          );
          break;
        }
        case "delete-evidence": {
          const { id: evidenceId } = z.object({ id: uuid }).strict().parse(input);
          if (!state.evidence.some((e) => e.id === evidenceId))
            throw new PolicyError("Document not found.");
          await rm(join(privateRoot, session, "files", evidenceId), { force: true });
          state.evidence = state.evidence.filter((e) => e.id !== evidenceId);
          for (const c of state.claims)
            if (c.evidenceIds.includes(evidenceId)) {
              c.evidenceIds = c.evidenceIds.filter((v) => v !== evidenceId);
              c.status = "needs_evidence";
              c.signedAt = null;
              c.typedName = null;
              c.packetHash = packetHash(
                entitlement(state, c.entitlementId),
                state.evidence.filter((e) => c.evidenceIds.includes(e.id)),
              );
            }
          event(state, "YOU", "Deleted document and invalidated affected attestations.");
          break;
        }
        case "delete-workspace": {
          await rm(join(privateRoot, session), { recursive: true, force: true });
          Object.assign(state, initialWorkspace());
          break;
        }
        default:
          throw new PolicyError("Unsupported action. Automatic submission is not implemented.");
      }
      return state;
    });
    if (filerJob) void runFiler(session, filerJob);
    if (job) {
      const pending = job as { runId: string; mode: "live" | "demo" };
      void runScout(session, pending.runId, pending.mode);
    }
    return new Response(JSON.stringify(result), { headers });
  } catch (error) {
    const expected = error instanceof PolicyError || error instanceof z.ZodError;
    return new Response(
      JSON.stringify({
        error:
          error instanceof z.ZodError
            ? "Invalid request fields."
            : expected
              ? (error as Error).message
              : "The operation could not be completed. Check the local service configuration.",
      }),
      { status: expected ? 400 : 500, headers },
    );
  }
}
