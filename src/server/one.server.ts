import { emailDraft } from "./conduit";
import { PolicyError } from "./policy";

/** Single-owner, loopback development connector. Never expose as a multi-user service. */
export async function createGmailDraft(subject: string, body: string) {
  const secret = process.env["ONE_SECRET"];
  const connection = process.env["ONE_GMAIL_CONNECTION_KEY"];
  if (process.env["CLAIMANT_LOCAL_MODE"] !== "true" || !secret || !connection)
    throw new PolicyError("One Gmail is not configured for this local workspace.");
  // Fixed method and endpoint: caller input cannot select send or another mailbox.
  const response = await fetch("https://api.withone.ai/v1/passthrough/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      "x-one-secret": secret,
      "x-one-connection-key": connection,
      "x-one-action-id": "conn_mod_def::GJ3oaMOtsBE::KznPt5lMTxmqAv5VYAqxwQ",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: { raw: Buffer.from(emailDraft(subject, body)).toString("base64url") },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new PolicyError(
      `One could not confirm draft creation (HTTP ${response.status}). Check Gmail Drafts before trying again.`,
    );
  const result = (await response.json()) as { id?: string };
  if (!result.id || typeof result.id !== "string")
    throw new PolicyError(
      "One returned an unrecognized draft response. Check Gmail Drafts before retrying.",
    );
  return { draftId: result.id, reviewUrl: "https://mail.google.com/mail/#drafts" };
}
