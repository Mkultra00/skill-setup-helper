import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ENTITLEMENTS, type Entitlement } from "@/lib/claimant-data";

export const Route = createFileRoute("/briefing")({
  head: () => ({
    meta: [
      { title: "Your briefing — Claimant" },
      {
        name: "description",
        content:
          "A ranked list of settlements you may be owed, each with what it is, why you qualify, what it is worth and when it closes.",
      },
      { property: "og:title", content: "Your briefing — Claimant" },
      {
        property: "og:description",
        content:
          "What you may be owed, why you qualify, what proof is needed and when the window closes.",
      },
    ],
  }),
  component: Briefing,
});

const SEARCH_LINES = [
  "Reading open settlement notices",
  "Checking court dockets for claim windows",
  "Matching administrators to what you use",
  "Writing your briefing in plain language",
];

function Briefing() {
  const [line, setLine] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (line >= SEARCH_LINES.length - 1) {
      const t = setTimeout(() => setDone(true), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLine((l) => l + 1), 750);
    return () => clearTimeout(t);
  }, [line]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-display text-2xl tracking-tight">
            Claimant
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Class actions
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-14">
        {!done ? (
          <div className="rule-grid rounded-md border border-border p-8">
            <h1 className="font-display text-3xl">Looking for what you are owed</h1>
            <ul className="mt-6 space-y-3">
              {SEARCH_LINES.map((text, i) => (
                <li
                  key={text}
                  className={`flex items-center gap-3 text-sm transition-opacity ${
                    i <= line ? "opacity-100" : "opacity-30"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      i < line ? "bg-primary" : i === line ? "bg-accent" : "bg-border"
                    }`}
                  />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <h1 className="font-display text-4xl tracking-tight">
              Three things you may be owed
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Ranked by how likely you are to qualify. Nothing is submitted until you read it and
              sign it yourself.
            </p>
            <div className="mt-10 space-y-4">
              {ENTITLEMENTS.map((e) => (
                <Card key={e.id} entitlement={e} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const CONFIDENCE_COPY: Record<Entitlement["confidence"], string> = {
  strong: "Strong match",
  possible: "Possible match",
  "long shot": "Long shot",
};

function Card({ entitlement: e }: { entitlement: Entitlement }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-md border border-foreground/15 bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-6 p-6 text-left"
      >
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {CONFIDENCE_COPY[e.confidence]} · closes {e.deadline}
          </span>
          <h2 className="mt-2 font-display text-2xl leading-tight">{e.title}</h2>
          <p className="mt-2 max-w-xl text-sm text-foreground/80">{e.whatItIs}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl">{e.estimate}</div>
          <div className="mt-1 text-xs text-muted-foreground">estimated</div>
        </div>
      </button>

      {open && (
        <div className="space-y-6 border-t border-border p-6 text-sm">
          <Section title="Why you may qualify">
            <ul className="space-y-1.5">
              {e.whyYouQualify.map((r) => (
                <li key={r} className="flex gap-2 text-foreground/80">
                  <span className="text-accent">—</span>
                  {r}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="What it could be worth">
            <p className="text-foreground/80">{e.estimateBasis}</p>
          </Section>
          <Section title="What proof you need">
            <ul className="space-y-1.5">
              {e.proofNeeded.map((p) => (
                <li key={p} className="flex gap-2 text-foreground/80">
                  <span className="text-accent">—</span>
                  {p}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Where this came from">
            <ul className="space-y-1.5">
              {e.sources.map((s) => (
                <li key={s.url}>
                  <a
                    className="text-primary underline underline-offset-4"
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Handled by {e.administrator}. They decide the claim, not us.
            </p>
          </Section>
          <Link
            to="/claim/$claimId"
            params={{ claimId: e.id }}
            className="inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start this claim
          </Link>
        </div>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}
