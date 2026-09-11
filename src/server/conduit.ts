/** Draft-only boundary, matching TDD §4.2. Deliberately no send method. */
export interface MessageConnector {
  search(query: {
    merchant: string;
    after: string;
    before: string;
    consentId: string;
  }): Promise<{ id: string; subject: string }[]>;
  draft(input: {
    to: string;
    subject: string;
    body: string;
    consentId: string;
  }): Promise<{ draftId: string; reviewUrl: string }>;
}
export function emailDraft(subject: string, body: string): string {
  // Recipient is deliberately blank: the user must obtain it from the official administrator.
  const safeSubject = subject.replace(/[\r\n]/g, " ").slice(0, 180);
  return [
    "X-Unsent: 1",
    "To:",
    "Subject: =?UTF-8?B?" + Buffer.from(safeSubject).toString("base64") + "?=",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body)
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") || "",
  ].join("\r\n");
}
