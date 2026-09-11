import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Check,
  Download,
  FileText,
  FlaskConical,
  FolderLock,
  Loader2,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { money, shortDate, statusLabel, type View, type Workspace } from "@/lib/claimant-data";
import type { Mutate } from "./claim-review";
export function UtilityViews({
  view,
  state,
  mutate,
  busy,
  onOpenClaim,
  onDiscover,
}: {
  view: View;
  state: Workspace;
  mutate: Mutate;
  busy: boolean;
  onOpenClaim: (id: string) => void;
  onDiscover: () => void;
}) {
  const upload = useRef<HTMLInputElement>(null);
  const [minimum, setMinimum] = useState(state.minimumPayout);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [result, setResult] = useState<{
    checks: { name: string; passed: boolean }[];
    mode: string;
    sandboxId?: string;
    sandboxName?: string;
    artifactPath?: string;
    retained?: boolean;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const titles = {
    tracker: ["Your claims, in one place.", "Know what’s next, and whose turn it is."],
    vault: [
      "Every claim starts with evidence.",
      "Your documents, their origins, and a fingerprint of every file.",
    ],
    memory: [
      "A little more you, every time.",
      "Inspect what your agents remember. Correct it or forget it.",
    ],
    settings: [
      "Your data. Your decisions.",
      "Clear boundaries for research, evidence and connected sources.",
    ],
    sandbox: [
      "Trust is a testable property.",
      "Exercise the claim boundary with synthetic data and no real submissions.",
    ],
    discover: ["", ""],
  };
  async function addFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Choose a file under 5 MB.");
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    if (await mutate("evidence", { name: file.name, content: btoa(binary), mime: file.type }))
      toast.success("Document stored with a SHA-256 fingerprint.");
  }
  async function tests(mode: "local" | "daytona") {
    setTesting(true);
    setResult(null);
    try {
      setResult(await api("sandbox", { mode }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {view === "sandbox" ? "DAYTONA / SAFETY HARNESS" : "YOUR WORKSPACE"}
          </div>
          <h1 className="smaller-title">{titles[view][0]}</h1>
          <p>{titles[view][1]}</p>
        </div>
        {view === "vault" && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => upload.current?.click()}
          >
            <Plus size={17} />
            Add document
          </button>
        )}
      </div>
      {view === "tracker" && (
        <>
          {state.claims.length === 0 ? (
            <div className="empty-state large">
              <FileText size={36} />
              <h2>A clear path from discovery to review.</h2>
              <p>Your prepared claims will appear here. Nothing is submitted automatically.</p>
              <button className="button primary" onClick={onDiscover}>
                Explore opportunities
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="utility-grid">
              {state.claims.map((c) => {
                const e = state.entitlements.find((e) => e.id === c.entitlementId);
                return (
                  <article className="content-panel tracker-card" key={c.id}>
                    <span className="pill cyan">{statusLabel[c.status]}</span>
                    <h2>{e?.title}</h2>
                    <p>{e?.administrator}</p>
                    <div className="tracker-amount">
                      {money(e?.payoutLow || 0)}–{money(e?.payoutHigh || 0)}
                      <small>estimated · not a payment promise</small>
                    </div>
                    <div className="mini-steps">
                      {Array.from({ length: 6 }, (_, i) => (
                        <span
                          key={i}
                          className={
                            i <
                            (c.status === "needs_evidence" ? 1 : c.status === "attested" ? 3 : 2)
                              ? "filled"
                              : ""
                          }
                        />
                      ))}
                    </div>
                    <p className="muted">
                      Next:{" "}
                      {c.status === "needs_evidence"
                        ? "resolve evidence gaps"
                        : c.status === "attested"
                          ? "your submission on the official site"
                          : "your review"}
                    </p>
                    <button className="button secondary full" onClick={() => onOpenClaim(c.id)}>
                      Open claim
                      <ArrowRight size={15} />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      {view === "vault" && (
        <>
          <input
            type="file"
            ref={upload}
            className="sr-only"
            accept=".pdf,.txt,.png,.jpg,.jpeg"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void addFile(f);
              e.target.value = "";
            }}
          />
          <div className="privacy-block">
            <FolderLock size={23} />
            <p>
              Files are stored privately on this development server. They are never sent to You.com.
              Add synthetic documents for this preview; production encryption and account
              authentication require the Supabase deployment.
            </p>
          </div>
          {state.evidence.length === 0 ? (
            <button className="upload-zone" disabled={busy} onClick={() => upload.current?.click()}>
              <Plus size={26} />
              <strong>Add your first piece of evidence</strong>
              <span>PDF, plain text, PNG or JPEG · up to 5 MB</span>
            </button>
          ) : (
            <div className="document-list">
              {state.evidence.map((e) => (
                <article className="document-row" key={e.id}>
                  <span className="document-icon">
                    <FileText />
                  </span>
                  <div>
                    <strong>{e.name}</strong>
                    <p>
                      {e.source} · {Math.ceil(e.size / 1024)} KB · {shortDate(e.createdAt)}
                    </p>
                    <code>SHA-256 {e.sha256}</code>
                  </div>
                  <a
                    className="icon-button"
                    aria-label={`Download ${e.name}`}
                    href={`/api/claimant/evidence/${e.id}`}
                  >
                    <Download size={17} />
                  </a>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${e.name}`}
                    disabled={busy}
                    onClick={async () => {
                      if (await mutate("delete-evidence", { id: e.id }))
                        toast.success("File deleted. Any dependent signature was invalidated.");
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {view === "memory" && (
        <div className="settings-layout">
          <section className="content-panel">
            <span className="eyebrow">SEMANTIC MEMORY</span>
            <h2>Teach SCOUT what matters.</h2>
            <label className="field-label" htmlFor="minimum">
              Hide opportunities worth less than
            </label>
            <div className="inline-form">
              <span>$</span>
              <input
                className="field"
                id="minimum"
                type="number"
                min="0"
                max="10000"
                value={minimum}
                onChange={(e) => setMinimum(Number(e.target.value))}
              />
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  if (await mutate("preferences", { minimumPayout: minimum }))
                    toast.success("Saved. Discovery now uses your minimum value.");
                }}
              >
                Save preference
              </button>
            </div>
            <p className="muted">
              This preference changes filtering immediately. Dismissed opportunities are also
              excluded from future results.
            </p>
            <h3 className="section-subtitle">Remembered preferences</h3>
            {state.memories.length ? (
              state.memories.map((m) => (
                <div className="memory-row" key={m.id}>
                  <BrainCircuit size={18} />
                  <div>
                    <span className="eyebrow">{m.kind}</span>
                    <p>{m.content}</p>
                    <small>{shortDate(m.createdAt)}</small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Forget ${m.content}`}
                    onClick={() => void mutate("forget", { id: m.id })}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            ) : (
              <p className="muted">No memories yet. Set a preference or dismiss an opportunity.</p>
            )}
          </section>
          <section className="content-panel">
            <span className="eyebrow">EPISODIC MEMORY</span>
            <h2>A visible trail.</h2>
            {state.events.length ? (
              state.events.slice(0, 12).map((e) => (
                <div className="activity" key={e.id}>
                  <span className="activity-dot" />
                  <div>
                    <strong>{e.agent}</strong> {e.message}
                    <small>{new Date(e.at).toLocaleTimeString()}</small>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">Your activity will appear here as you explore.</p>
            )}
            <div className="privacy-block">
              <ShieldCheck />
              <p>
                Cross-user playbooks are not active in this preview. Promotion must preserve
                attestation accuracy and meet the minimum observation threshold.
              </p>
            </div>
          </section>
        </div>
      )}
      {view === "settings" && (
        <div className="settings-layout">
          <section className="content-panel">
            <h2>Connected services</h2>
            {[
              ["You.com", "Live, cited discovery", state.integrations.you],
              ["Daytona", "Isolated safety tests", state.integrations.daytona],
              ["CrewAI", "Python claim preparation service", state.integrations.crewai],
              ["Gmail / One", "Create reviewed claim drafts", state.integrations.conduit],
            ].map(([title, desc, configured]) => (
              <div className="integration-row" key={String(title)}>
                <div>
                  <strong>{title}</strong>
                  <p>{desc}</p>
                </div>
                <span className={`pill ${configured ? "cyan" : ""}`}>
                  {configured ? "Key configured" : "Not connected"}
                </span>
              </div>
            ))}
            <p className="muted">
              Configured does not mean tested. Credentials remain server-side. Draft creation
              requires your action; nothing scans your inbox.
            </p>
            <h3 className="section-subtitle">Research consent</h3>
            <p>
              {state.researchConsent
                ? "You allowed broad sample signals to be sent to You.com."
                : "No live research consent recorded."}
            </p>
            {state.researchConsent && (
              <button
                className="button secondary"
                onClick={() => void mutate("revoke-consent", {})}
              >
                Revoke future research access
              </button>
            )}
          </section>
          <section className="content-panel">
            <h2>Workspace controls</h2>
            <p>
              Export your records, clear your preferences, or delete this browser session’s
              workspace.
            </p>
            <a className="button secondary full" href="/api/claimant/export">
              <Download size={16} />
              Export workspace records
            </a>
            <button
              className="button secondary full"
              onClick={() => void mutate("clear-memory", {})}
            >
              <BrainCircuit size={16} />
              Forget all preferences
            </button>
            <button className="button danger full" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} />
              Delete workspace data
            </button>
            <div className="privacy-block">
              <ShieldCheck />
              <p>
                FYOUMONEY never files in bulk, signs for you, or routes settlement payments through
                the platform.
              </p>
            </div>
          </section>
        </div>
      )}
      {view === "sandbox" && (
        <>
          <div className="sandbox-intro content-panel">
            <span className="pill cyan">SYNTHETIC DATA ONLY</span>
            <h2>The failure cases are the important ones.</h2>
            <p>
              Run the claim-boundary harness locally or inside a retained Daytona sandbox. The
              checks cover bulk attempts, unconfirmed statements, changed evidence, and
              personal-data leakage.
            </p>
            <div className="review-actions">
              <button
                className="button primary"
                disabled={testing || !state.integrations.daytona}
                onClick={() => void tests("daytona")}
              >
                {testing ? <Loader2 className="spin" size={17} /> : <FlaskConical size={17} />}Run
                in Daytona
              </button>
              <button
                className="button secondary"
                disabled={testing}
                onClick={() => void tests("local")}
              >
                Run local policy checks
              </button>
            </div>
            <p className="muted">
              Daytona creates a real sandbox using your credits, runs only fixed synthetic test
              code, and retains it for inspection. It auto-stops after five minutes of inactivity;
              automatic deletion is disabled.
            </p>
          </div>
          {testing && (
            <div className="privacy-block" role="status">
              <Loader2 className="spin" />
              <p>Running the boundary checks. The sandbox may take a moment to start.</p>
            </div>
          )}
          {result && (
            <div className="content-panel">
              <span className="eyebrow">{result.mode.toUpperCase()} TEST RESULTS</span>
              <h2>
                {result.checks.filter((c) => c.passed).length} / {result.checks.length} checks
                passed
              </h2>
              {result.sandboxId && (
                <p className="muted">
                  Sandbox {result.sandboxName || result.sandboxId}
                  <br />
                  {result.sandboxId}
                </p>
              )}
              {result.retained && (
                <p className="muted">
                  Retained for inspection. Files: {result.artifactPath}/boundary_harness.py and
                  results.json.{" "}
                  <a
                    href="https://app.daytona.io/dashboard/sandboxes"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Daytona dashboard
                  </a>
                </p>
              )}
              {result.checks.map((c) => (
                <div className="test-row" key={c.name}>
                  <span className={`pill ${c.passed ? "cyan" : "amber"}`}>
                    {c.passed ? "PASS" : "FAIL"}
                  </span>
                  {c.name}
                </div>
              ))}
              <p className="muted">
                These are executable invariant tests, not a proof of legal compliance or the entire
                platform.
              </p>
            </div>
          )}
        </>
      )}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="claimant-dialog">
          <DialogHeader>
            <DialogTitle>Delete this workspace’s data?</DialogTitle>
            <DialogDescription>
              This removes uploaded files, claim records, consent and memories from this development
              server. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <button
            className="button danger"
            disabled={busy}
            onClick={async () => {
              if (await mutate("delete-workspace", {})) {
                setConfirmDelete(false);
                toast.success("Workspace data deleted. Only the public demo catalog remains.");
              }
            }}
          >
            Delete my workspace data
          </button>
          <button className="button secondary" onClick={() => setConfirmDelete(false)}>
            Keep my data
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
