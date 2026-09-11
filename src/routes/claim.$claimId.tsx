import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";

import { CLAIM_STEPS, getEntitlement, type StepState } from "@/lib/claimant-data";

export const Route = createFileRoute("/claim/$claimId")({
  head: () => ({
    meta: [
      { title: "Your claim — Claimant" },
      {
        name: "description",
        content:
          "Follow your claim step by step. Claimant prepares everything; you read it, sign it and send it yourself.",
      },
      { property: "og:title", content: "Your claim — Claimant" },
      {
        property: "og:description",
        content: "Everything prepared for you, with the signature left where it belongs.",
      },
    ],
  }),
  loader: ({ params }) => {
    const entitlement = getEntitlement(params.claimId);
    if (!entitlement) throw notFound();
    return { entitlement };
  },
  component: Claim,
});

function Claim() {
  const { entitlement } = Route.useLoaderData();
  // Steps 0-2 are prepared by the agents before the human gate.
  const [current, setCurrent] = useState(3);
  const [confirmed, setConfirmed] = useState(false);
  const [signature, setSignature] = useState("");

  const stateFor = (i: number): StepState => {
    if (i < current) return "done";
    if (i > current) return CLAIM_STEPS[i]!.actor === "administrator" ? "waiting on them" : "blocked";
    return CLAIM_STEPS[i]!.actor === "you" ? "waiting on you" : "active";
  };

  const canSign = confirmed && signature.trim().length > 2;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-display text-2xl tracking-tight">
            Claimant
          </Link>
          <Link to="/briefing" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to briefing
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-12 px-6 py-12 lg:grid-cols-[18rem_1fr]">
        <aside>
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Your claim
          </h2>
          <ol className="mt-4 space-y-1">
            {CLAIM_STEPS.map((step, i) => {
              const state = stateFor(i);
              return (
                <li
                  key={step.key}
                  className={`rounded-md border-l-2 py-2 pl-3 ${
                    state === "done"
                      ? "border-primary"
                      : state === "waiting on you"
                        ? "border-accent bg-secondary"
                        : state === "active"
                          ? "border-accent"
                          : "border-border"
                  }`}
                >
                  <div
                    className={`text-sm ${state === "blocked" ? "text-muted-foreground" : "font-medium"}`}
                  >
                    {i + 1}. {step.title}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {state}
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <section>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {entitlement.administrator} · closes {entitlement.deadline}
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight">
            {entitlement.title}
          </h1>

          {current < 3 && (
            <div className="mt-8 rounded-md border border-border bg-card p-6">
              <h2 className="font-display text-2xl">{CLAIM_STEPS[current]!.title}</h2>
              <p className="mt-2 text-sm text-foreground/80">{CLAIM_STEPS[current]!.summary}</p>
              <p className="mt-3 text-sm text-muted-foreground">{CLAIM_STEPS[current]!.detail}</p>
              <button
                type="button"
                onClick={() => setCurrent((c) => c + 1)}
                className="mt-6 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Continue
              </button>
            </div>
          )}

          {current === 3 && (
            <div className="mt-8 space-y-6">
              <div className="rounded-md border border-border bg-card p-6">
                <h2 className="font-display text-2xl">Read this before you sign</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Everything below was prepared for you. Check that it is true — you are the one
                  making this statement.
                </p>
                <dl className="mt-6 divide-y divide-border text-sm">
                  <Row label="Claiming as" value="The account holder named on your profile" />
                  <Row label="Basis of the claim" value={entitlement.whyYouQualify[0]!} />
                  <Row label="Proof attached" value={entitlement.proofNeeded.join(", ")} />
                  <Row label="Estimated payment" value={`${entitlement.estimate}, paid to you directly`} />
                </dl>
              </div>

              <div className="rounded-md border-l-2 border-accent bg-secondary/60 p-6">
                <label className="flex gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1 size-4 accent-[var(--primary)]"
                  />
                  <span>
                    I have read this claim and everything in it is true to the best of my
                    knowledge.
                  </span>
                </label>
                <div className="mt-5">
                  <label htmlFor="signature" className="block text-sm font-medium">
                    Type your full name to sign
                  </label>
                  <input
                    id="signature"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Your full name"
                    className="mt-2 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 font-display text-xl outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  disabled={!canSign}
                  onClick={() => setCurrent(4)}
                  className="mt-6 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sign this claim
                </button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Nobody can sign this for you. That is what keeps the claim valid and the money
                  yours.
                </p>
              </div>
            </div>
          )}

          {current === 4 && (
            <div className="mt-8 rounded-md border border-border bg-card p-6">
              <h2 className="font-display text-2xl">Signed. Ready to send.</h2>
              <p className="mt-2 text-sm text-foreground/80">
                Signed by {signature}. Sending it is your call — press the button and we deliver
                exactly what you just read, then keep the receipt.
              </p>
              <button
                type="button"
                onClick={() => setCurrent(5)}
                className="mt-6 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Send my claim
              </button>
            </div>
          )}

          {current === 5 && (
            <div className="mt-8 rounded-md border-l-2 border-primary bg-secondary/60 p-6">
              <h2 className="font-display text-2xl">Sent. We will watch it from here.</h2>
              <p className="mt-2 text-sm text-foreground/80">
                {entitlement.administrator} has your claim. We will check in on it and tell you the
                moment anything changes, including if the deadline passes with no reply.
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                This preview stops here — real delivery and tracking arrive with the next release.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
