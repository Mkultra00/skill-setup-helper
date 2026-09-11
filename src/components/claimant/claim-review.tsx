import { TaxPanel } from "./tax-panel";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Download,
  ExternalLink,
  FileText,
  LockKeyhole,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { type Workspace, type Claim, type Entitlement, money } from "@/lib/claimant-data";
export type Mutate = (action: string, data: unknown) => Promise<Workspace | null>;
export function ClaimReview({
  state,
  claim,
  entitlement: e,
  busy,
  mutate,
  onBack,
}: {
  state: Workspace;
  claim: Claim;
  entitlement: Entitlement;
  busy: boolean;
  mutate: Mutate;
  onBack: () => void;
}) {
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const index =
    claim.status === "needs_evidence"
      ? 1
      : claim.status === "submitted"
        ? 4
        : claim.status === "attested"
          ? 3
          : 2;
  const steps = [
    ["Check requirements", "FILER · Source-backed review"],
    ["Gather evidence", "YOU · Resolve missing proof"],
    ["Review & attest", "YOU · Every statement matters"],
    ["Submit your claim", "YOU · On the official portal"],
    ["Administrator review", "ADMIN · Await confirmation"],
    ["Payment", "ADMIN · Paid directly to you"],
  ];
  async function download() {
    try {
      const packet = await api<Record<string, unknown>>("packet", { claimId: claim.id });
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `claimant-${claim.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  async function saveGmailDraft() {
    setDraftBusy(true);
    try {
      await api("gmail-draft", { claimId: claim.id });
      setDraftReady(true);
      toast.success(
        "Saved to Gmail Drafts. Add the official recipient and reviewed attachments before sending.",
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDraftBusy(false);
    }
  }
  async function downloadEmail() {
    try {
      const draft = await api<{ filename: string; content: string }>("email-draft", {
        claimId: claim.id,
      });
      const url = URL.createObjectURL(new Blob([draft.content], { type: "message/rfc822" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = draft.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Unsent draft downloaded. Review and send from your own mailbox.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to workspace
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {e.demo ? "DEMO CLAIM · NOTHING WILL BE SUBMITTED" : "CLAIM PREPARATION"}
          </div>
          <h1 className="smaller-title">{e.title}</h1>
          <p>
            {e.administrator} · {money(e.payoutLow)}–{money(e.payoutHigh)} estimated
          </p>
        </div>
      </div>
      <div className="claim-layout">
        <aside className="stepper">
          <span className="eyebrow">YOUR CLAIM JOURNEY</span>
          {steps.map(([title, subtitle], i) => (
            <div
              className={`claim-step ${i < index ? "done" : i === index ? "current" : ""}`}
              key={title}
            >
              <span>{i < index ? <Check size={16} /> : i + 1}</span>
              <div>
                <strong>{title}</strong>
                <small>{subtitle}</small>
              </div>
            </div>
          ))}
          <div className="hash-label">
            <LockKeyhole size={14} />
            Packet fingerprint<code>{claim.packetHash.slice(0, 24)}…</code>
          </div>
        </aside>
        <section className="review-content">
          <TaxPanel key={e.id} entitlement={e} />
          {claim.status === "analyzing" ? (
            <div className="content-panel">
              <Loader2 className="spin" />
              <h2>FILER is reading the requirements.</h2>
              <p>
                The CrewAI analyst and gap auditor are checking the public source. This may take a
                few minutes. No private documents are sent to the research provider.
              </p>
            </div>
          ) : claim.status === "needs_evidence" ? (
            <div className="content-panel">
              <span className="pill amber">Preparation paused</span>
              {e.demo && (
                <div className="attestation-warning">
                  <span>
                    Demo persona: Jordan Example. Select FICTIONAL-demo-receipt.txt, then explain:
                    “The sample receipt shows a headset purchased on June 15, 2025.” Use Jordan
                    Example for the practice signature.
                  </span>
                </div>
              )}
              <h2>Let’s close the evidence gaps.</h2>
              {claim.preparationEvents?.map((message, i) => (
                <p className="muted" key={i}>
                  {message}
                </p>
              ))}
              <p>
                We will not invent missing facts or mark an uploaded file as proof without reviewing
                its contents.
              </p>
              <label className="field-label" htmlFor="claim-evidence">
                Upload evidence to your private vault
              </label>
              <input
                id="claim-evidence"
                type="file"
                accept=".pdf,.txt,.png,.jpg,.jpeg"
                disabled={busy}
                onChange={async (ev) => {
                  const file = ev.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error("Choose a file under 5 MB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    void mutate("evidence", {
                      name: file.name,
                      mime: file.type,
                      content: String(reader.result).split(",")[1],
                    });
                  };
                  reader.readAsDataURL(file);
                  ev.target.value = "";
                }}
              />
              {e.predicates.map((p) => (
                <RequirementReview
                  key={p.id}
                  predicate={p}
                  state={state}
                  claimId={claim.id}
                  proofRequired={e.proofRequired}
                  busy={busy}
                  mutate={mutate}
                />
              ))}
              <p className="muted">
                Document review is your factual assessment. FYOUMONEY records it as unverified until
                you separately attest to each statement.
              </p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void mutate("retry-analysis", { claimId: claim.id })}
              >
                Retry source analysis
              </button>
              <button
                className="button secondary"
                onClick={() => void mutate("claim-state", { claimId: claim.id, status: "parked" })}
              >
                Save for later
              </button>
            </div>
          ) : claim.status === "parked" ? (
            <div className="content-panel">
              <h2>Saved until you’re ready.</h2>
              <p>No signature was recorded and nothing was sent.</p>
              <button
                className="button primary"
                onClick={() => void mutate("claim-state", { claimId: claim.id, status: "resume" })}
              >
                Resume review
                <ArrowRight size={16} />
              </button>
            </div>
          ) : claim.status === "ready_to_sign" ? (
            <>
              <div className="content-panel">
                <span className="eyebrow">THE HUMAN CHECKPOINT</span>
                <h2>Read it. Make it yours.</h2>
                <p>
                  Confirm each statement yourself. If anything is uncertain, save the claim and come
                  back.
                </p>
                <div className="attestation-warning">
                  <ShieldCheck size={20} />
                  <span>
                    {e.demo
                      ? "Practice attestation only. Use a fictional name; this is not a real claim."
                      : "This is a factual attestation. Only confirm statements you know to be accurate."}
                  </span>
                </div>
                {e.predicates.map((p) => (
                  <label className="attestation-row" key={p.id}>
                    <Checkbox
                      checked={checked.includes(p.id)}
                      onCheckedChange={(v) =>
                        setChecked(
                          v === true ? [...checked, p.id] : checked.filter((id) => id !== p.id),
                        )
                      }
                    />
                    <span>
                      {p.text}
                      <small>Source: {p.sourceQuote}</small>
                    </span>
                  </label>
                ))}
                <label className="field-label" htmlFor="signature">
                  {e.demo ? "Type a fictional full name" : "Type your full name"}
                </label>
                <input
                  id="signature"
                  className="field signature"
                  value={name}
                  maxLength={120}
                  onChange={(ev) => setName(ev.target.value)}
                  placeholder={e.demo ? "Jordan Example" : "Full name"}
                />
                <div className="review-actions">
                  <button
                    className="button primary"
                    disabled={
                      busy || checked.length !== e.predicates.length || name.trim().length < 3
                    }
                    onClick={async () => {
                      if (
                        await mutate("attest", {
                          claimId: claim.id,
                          typedName: name,
                          packetHash: claim.packetHash,
                          checkboxes: checked,
                        })
                      )
                        toast.success("Attestation saved. Nothing has been submitted.");
                    }}
                  >
                    Confirm & continue
                    <ArrowRight size={16} />
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void mutate("claim-state", { claimId: claim.id, status: "parked" })
                    }
                  >
                    I’m not sure — save for later
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="content-panel">
              <span className="pill cyan">
                {claim.status === "submitted" ? "Recorded by you" : "Attestation saved"}
              </span>
              <h2>
                {claim.status === "submitted"
                  ? "Your submission record."
                  : "Prepared. The next step is yours."}
              </h2>
              <p>
                Signed by {claim.typedName}. FYOUMONEY has not transmitted this packet to an
                administrator.
              </p>
              <button className="button secondary" onClick={() => void download()}>
                <Download size={16} />
                Download preparation packet
              </button>
              <button className="button secondary" onClick={() => void downloadEmail()}>
                Download email draft
              </button>
              {state.integrations.conduit && (
                <button
                  className="button secondary"
                  disabled={draftBusy}
                  onClick={() => void saveGmailDraft()}
                >
                  {draftBusy ? "Creating draft…" : "Save draft to Gmail"}
                </button>
              )}
              {(draftReady || claim.gmailDraftId) && (
                <a
                  className="button secondary"
                  href="https://mail.google.com/mail/#drafts"
                  target="_blank"
                  rel="noreferrer"
                >
                  Review in Gmail
                </a>
              )}

              {e.officialUrl ? (
                <a
                  className="button primary"
                  href={e.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open official portal
                  <ExternalLink size={15} />
                </a>
              ) : (
                <div className="attestation-warning">
                  This fictional opportunity has no submission portal. The demo stops before any
                  real submission.
                </div>
              )}
              {!e.demo && claim.status === "attested" && (
                <div className="confirmation-box">
                  <label htmlFor="confirmation" className="field-label">
                    After submitting yourself, record your confirmation
                  </label>
                  <input
                    id="confirmation"
                    className="field"
                    value={confirmation}
                    onChange={(ev) => setConfirmation(ev.target.value)}
                    placeholder="Administrator confirmation number"
                  />
                  <button
                    className="button secondary"
                    disabled={confirmation.trim().length < 3 || busy}
                    onClick={() =>
                      void mutate("record-submission", { claimId: claim.id, confirmation })
                    }
                  >
                    Record my submission
                  </button>
                </div>
              )}
              {claim.confirmation && (
                <p className="muted">
                  User-reported confirmation: {claim.confirmation}. Administrator acceptance is not
                  independently verified.
                </p>
              )}
            </div>
          )}
          <div className="content-panel compact-panel">
            <h3>
              <FileText size={17} />
              Evidence in this packet
            </h3>
            {claim.evidenceIds.length ? (
              state.evidence
                .filter((ev) => claim.evidenceIds.includes(ev.id))
                .map((ev) => (
                  <p key={ev.id}>
                    {ev.name} · {ev.source}
                  </p>
                ))
            ) : (
              <p className="muted">
                No documents attached. Review the requirements; absence of an attachment does not
                establish eligibility.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function RequirementReview({
  predicate: p,
  state,
  claimId,
  proofRequired,
  busy,
  mutate,
}: {
  predicate: Entitlement["predicates"][number];
  state: Workspace;
  claimId: string;
  proofRequired: boolean;
  busy: boolean;
  mutate: Mutate;
}) {
  const [evidenceId, setEvidenceId] = useState("");
  const [note, setNote] = useState("");
  const reviewed = p.status === "user_assertion_required" || p.status === "supported";
  return (
    <div className="requirement">
      <CircleHelp size={18} />
      <div>
        <strong>{p.text}</strong>
        <small>{p.reasoning}</small>
        <blockquote>{p.sourceQuote}</blockquote>
        {reviewed ? (
          <span className="pill cyan">Ready for your final attestation</span>
        ) : (
          <>
            <label className="field-label" htmlFor={`doc-${p.id}`}>
              Document you reviewed {proofRequired ? "(required)" : "(optional)"}
            </label>
            <select
              className="field"
              id={`doc-${p.id}`}
              value={evidenceId}
              onChange={(ev) => setEvidenceId(ev.target.value)}
            >
              <option value="">Select a document</option>
              {state.evidence.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {evidenceId && (
              <a href={`/api/claimant/evidence/${evidenceId}`} target="_blank" rel="noreferrer">
                Open document for review
              </a>
            )}
            <label className="field-label" htmlFor={`note-${p.id}`}>
              What facts support this requirement?
            </label>
            <textarea
              className="field"
              id={`note-${p.id}`}
              value={note}
              maxLength={2000}
              onChange={(ev) => setNote(ev.target.value)}
              placeholder="Describe the relevant fact and where you found it. Do not confirm anything uncertain."
            />
            <button
              className="button secondary"
              disabled={busy || note.trim().length < 20 || (proofRequired && !evidenceId)}
              onClick={() =>
                void mutate("review-requirement", {
                  claimId,
                  predicateId: p.id,
                  evidenceId: evidenceId || undefined,
                  note,
                })
              }
            >
              Record my review
            </button>
          </>
        )}
      </div>
    </div>
  );
}
