import { createFileRoute, Link } from "@tanstack/react-router";

import { TRACKS } from "@/lib/claimant-data";
import mascotAsset from "@/assets/unicorn-mascot.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "F You Money — find money that is already yours" },
      {
        name: "description",
        content:
          "F You Money finds settlements and refunds you may be owed, prepares the claim for you, and leaves the signature where it belongs: with you.",
      },
      { property: "og:title", content: "F You Money — find money that is already yours" },
      {
        property: "og:description",
        content:
          "F You Money finds settlements and refunds you may be owed and prepares the claim. You read it, sign it, and the payout comes straight to you.",
      },
    ],
  }),
  component: Discover,
});

function Discover() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <img
              src={mascotAsset.url}
              alt="F You Money unicorn mascot"
              className="h-10 w-auto"
            />
            <span className="font-display text-2xl tracking-tight">F You Money</span>
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Seraph Systems
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16 pt-20">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Step one of six
        </p>
        <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          There is money set aside with your name on it. Most of it goes unclaimed.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          F You Money searches for what you are owed, reads the fine print, and fills in the claim.
          Then it stops and hands it to you. You read it, you sign it, and the payout comes
          straight to you — never through us.
        </p>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {TRACKS.map((track) => {
            const body = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-2xl leading-tight">{track.name}</h2>
                  {!track.available && (
                    <span className="mt-1 shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                      Soon
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-foreground/80">{track.blurb}</p>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  {track.detail}
                </p>
              </>
            );

            return track.available ? (
              <Link
                key={track.id}
                to="/briefing"
                className="group flex flex-col rounded-md border border-foreground/15 bg-card p-6 transition-colors hover:border-primary hover:bg-secondary"
              >
                {body}
                <span className="mt-6 text-sm font-medium text-primary group-hover:underline">
                  Start searching →
                </span>
              </Link>
            ) : (
              <div
                key={track.id}
                className="flex flex-col rounded-md border border-dashed border-border p-6 opacity-70"
              >
                {body}
              </div>
            );
          })}
        </div>

        <div className="mt-16 max-w-2xl rounded-md border-l-2 border-accent bg-secondary/60 p-6">
          <h3 className="font-display text-xl">The one thing we will never do</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">
            We never file on your behalf, never take a share of your recovery, and never hold your
            money. Claims sent in bulk by a third party get thrown out — so the signature stays
            yours, and so does the payout.
          </p>
        </div>
      </section>
    </main>
  );
}
