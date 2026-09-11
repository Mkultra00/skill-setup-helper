import { useState } from "react";
import { Scale, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { TAX_STATES, type TaxReport } from "@/lib/tax";
import type { Entitlement } from "@/lib/claimant-data";
export function TaxPanel({ entitlement }: { entitlement: Entitlement }) {
  const [state, setState] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<TaxReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function research() {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      setReport(
        await api<TaxReport>("tax-research", {
          entitlementId: entitlement.id,
          state,
          taxYear: year,
          consent: true,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-panel" aria-label="Tax research">
      <span className="eyebrow">YOU.COM / TAX RESEARCH</span>
      <h2>
        <Scale size={20} /> Understand the tax questions.
      </h2>
      <p>
        Explore federal guidance and state tax rules relevant to this opportunity. Choose the state
        to research; this does not establish your residency or filing obligations.
      </p>
      <div className="attestation-warning" role="note">
        <span>
          <strong>Not professional advice.</strong> For informational purposes only. This is not
          tax, legal, or financial advice. AI-generated research may be incomplete or incorrect.
          Confirm your situation with a qualified tax professional before acting or filing.
        </span>
      </div>
      <div className="review-actions">
        <label className="field-label">
          State
          <select
            className="field"
            value={state}
            disabled={busy}
            onChange={(e) => {
              setState(e.target.value);
              setReport(null);
            }}
          >
            <option value="">Select a state</option>
            {TAX_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Tax year
          <input
            className="field"
            type="number"
            min={2020}
            max={new Date().getFullYear() + 1}
            value={year}
            disabled={busy}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setReport(null);
            }}
          />
        </label>
      </div>
      <p className="muted">
        By running research, you allow the public opportunity description, selected state and tax
        year to be sent to You.com. Receipts, signatures, email addresses and account details stay
        private.
      </p>
      <button
        className="button secondary"
        disabled={busy || !state || year < 2020 || year > new Date().getFullYear() + 1}
        onClick={() => void research()}
      >
        {busy ? (
          <>
            <Loader2 size={16} className="spin" />
            Researching federal & state sources…
          </>
        ) : (
          "Research federal & state taxes"
        )}
      </button>
      {error && <p role="alert">{error}</p>}
      {report && (
        <div aria-live="polite">
          <p className="muted">
            {report.state} · Tax year {report.taxYear} · Retrieved{" "}
            {new Date(report.researchedAt).toLocaleString()}
            {report.demo ? " · Fictional case context; live tax research" : ""}
          </p>
          {report.sections.map((section) => (
            <section key={section.jurisdiction}>
              <h3>{section.jurisdiction} guidance</h3>
              {section.error && <p role="alert">{section.error}</p>}
              {!section.error && !section.findings.length && (
                <p>No source-backed finding returned. Tax treatment remains unresolved.</p>
              )}
              {section.findings.map((f, i) => (
                <div className="requirement" key={i}>
                  <div>
                    <strong>{f.title}</strong>
                    <p>{f.explanation}</p>
                    <small>
                      {f.authority} · {f.effectivePeriod}
                    </small>
                    {f.sources.map((url, n) => (
                      <p key={url}>
                        <a href={url} target="_blank" rel="noreferrer">
                          Official source {n + 1} · {new URL(url).hostname}
                        </a>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
              {!!section.missingFacts.length && (
                <>
                  <h4>What still needs checking</h4>
                  <ul>
                    {section.missingFacts.map((fact, i) => (
                      <li key={i}>{fact}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))}
          <p className="muted">
            Research is separate from your claim attestation. No tax amount has been calculated and
            no filing or claim has been submitted.
          </p>
        </div>
      )}
    </section>
  );
}
