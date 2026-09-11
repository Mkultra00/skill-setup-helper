import { createHmac } from "node:crypto";
import { z } from "zod";
import type { Entitlement } from "../lib/claimant-data";
const resultSchema = z.object({
  status: z.enum(["needs_evidence", "ready_to_sign"]),
  events: z.array(z.string()).max(20),
  predicates: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().max(1500),
        sourceQuote: z.string().max(3000),
        status: z.enum(["unsupported", "user_assertion_required"]),
        reasoning: z.string(),
        evidenceIds: z.array(z.string()).max(0),
      }),
    )
    .min(1)
    .max(15),
});
export async function prepareClaim(entitlement: Entitlement) {
  const endpoint = process.env["CREWAI_SERVICE_URL"];
  const secret = process.env["CREWAI_HMAC_SECRET"];
  if (!endpoint || !secret) throw new Error("CrewAI FILER is not configured.");
  const body = JSON.stringify({
    title: entitlement.title,
    classDefinition: entitlement.classDefinition,
    officialUrl: entitlement.officialUrl,
    proofRequired: entitlement.proofRequired,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const response = await fetch(`${endpoint}/prepare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Claimant-Timestamp": timestamp,
      "X-Claimant-Signature": signature,
    },
    body,
    signal: AbortSignal.timeout(330000),
  });
  if (!response.ok)
    throw new Error(`CrewAI analysis failed (HTTP ${response.status}). The claim remains blocked.`);
  const result = resultSchema.parse(await response.json());
  // A remote agent is not trusted to remove a documentary requirement or invent quotations.
  for (const p of result.predicates) {
    if (entitlement.proofRequired || !entitlement.classDefinition.includes(p.sourceQuote))
      p.status = "unsupported";
  }
  return result;
}
