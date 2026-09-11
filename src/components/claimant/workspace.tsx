import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BrainCircuit,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  FileCheck2,
  FileText,
  FlaskConical,
  FolderLock,
  Layers3,
  Loader2,
  LockKeyhole,
  Mail,
  Menu,
  MoreHorizontal,
  Plus,
  Radar,
  RefreshCw,
  Scale,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast, Toaster } from "sonner";
import { api } from "@/lib/api";
import {
  DEMO_ENTITLEMENTS,
  TRACKS,
  money,
  shortDate,
  statusLabel,
  type Workspace,
  type View,
  type TrackId,
  type Entitlement,
  type Claim,
} from "@/lib/claimant-data";
import { ClaimReview } from "./claim-review";
import { UtilityViews } from "./utility-views";

const navigation = [
  { id: "discover", label: "Discover", icon: Compass },
  { id: "tracker", label: "My claims", icon: Layers3 },
  { id: "vault", label: "Evidence vault", icon: FolderLock },
  { id: "memory", label: "Agent memory", icon: BrainCircuit },
] as const;
const initial: Workspace = {
  entitlements: [],
  claims: [],
  evidence: [],
  memories: [],
  dismissed: [],
  saved: [],
  events: [],
  minimumPayout: 0,
  researchConsent: false,
  run: null,
  integrations: { you: false, crewai: false, daytona: false, conduit: false },
};
export function WorkspaceApp({ initialClaimId }: { initialClaimId?: string }) {
  const [state, setState] = useState<Workspace>(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("discover");
  const [track, setTrack] = useState<TrackId>("class_action");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recommended");
  const [activeClaim, setActiveClaim] = useState<string | null>(initialClaimId || null);
  const [detail, setDetail] = useState<Entitlement | null>(null);
  const [researchDialog, setResearchDialog] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setState(await api());
      setReady(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (state.run?.status !== "running" && !state.claims.some((c) => c.status === "analyzing"))
      return;
    const timer = setInterval(() => void load(), 1800);
    return () => clearInterval(timer);
  }, [state.run?.status, state.claims, load]);
  async function mutate(action: string, data: unknown) {
    setBusy(true);
    try {
      const next = await api(action, data);
      setState(next);
      return next;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function navigate(v: View) {
    setView(v);
    setActiveClaim(null);
    setMenu(false);
  }
  async function start(entitlement: Entitlement) {
    const next = await mutate("claims", { entitlementId: entitlement.id });
    if (next) {
      const c = next.claims.find((c) => c.entitlementId === entitlement.id);
      if (c) {
        setDetail(null);
        setActiveClaim(c.id);
      }
    }
  }
  async function scout() {
    const next = await mutate("scout", { mode: "live", consent: true });
    if (next) {
      setResearchDialog(false);
      toast.success("SCOUT is researching current sources.");
    }
  }
  const visible = state.entitlements
    .filter(
      (e) =>
        !e.demo &&
        e.track === track &&
        !state.dismissed.includes(e.id) &&
        e.payoutHigh >= state.minimumPayout &&
        `${e.title} ${e.category}`.toLowerCase().includes(search.toLowerCase()) &&
        (filter !== "saved" || state.saved.includes(e.id)) &&
        (filter !== "no-proof" || !e.proofRequired),
    )
    .sort((a, b) =>
      sort === "value"
        ? b.payoutHigh - a.payoutHigh
        : sort === "deadline"
          ? (a.deadline || "9999").localeCompare(b.deadline || "9999")
          : 0,
    );
  const claim = state.claims.find((c) => c.id === activeClaim || c.entitlementId === activeClaim);
  const opportunity = claim ? state.entitlements.find((e) => e.id === claim.entitlementId) : null;
  const total = state.entitlements
    .filter((e) => !e.demo && e.track === track && !state.dismissed.includes(e.id))
    .reduce((n, e) => n + e.payoutHigh, 0);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className={`app-sidebar ${menu ? "is-open" : ""}`}>
        <a href="/" className="brand">
          <img
            className="brand-mascot"
            src="/brand/fyoumoney-unicorn.png"
            alt="Happy unicorn holding a money bag"
          />
          FYOUMONEY
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">P</span>
          <div>
            Personal workspace<small>Individual account</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <button
              key={n.id}
              onClick={() => navigate(n.id)}
              className={`nav-item ${view === n.id && !activeClaim ? "selected" : ""}`}
            >
              <n.icon size={18} />
              {n.label}
              {n.id === "tracker" && state.claims.length > 0 && (
                <span className="nav-count">{state.claims.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-caption second">SYSTEM</div>
        <button
          className={`nav-item ${view === "sandbox" ? "selected" : ""}`}
          onClick={() => navigate("sandbox")}
        >
          <FlaskConical size={18} />
          Sandbox lab<span className="tiny-tag">TEST</span>
        </button>
        <button
          className={`nav-item ${view === "settings" ? "selected" : ""}`}
          onClick={() => navigate("settings")}
        >
          <Settings2 size={18} />
          Settings & consent
        </button>
        <div className="sidebar-bottom">
          <div className="trust-note">
            <ShieldCheck size={20} />
            <strong>Your claim. Your control.</strong>
            <p>
              Agents do the preparation.
              <br />
              You make the final call.
            </p>
            <button onClick={() => navigate("settings")}>
              Your privacy controls <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="profile">
            <span className="profile-avatar">JD</span>
            <div>
              Personal workspace<small>Local, private workspace</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              aria-label="Toggle navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {activeClaim
                ? "Claim review"
                : view === "discover"
                  ? "Discover"
                  : view === "tracker"
                    ? "My claims"
                    : view === "vault"
                      ? "Evidence vault"
                      : view === "memory"
                        ? "Agent memory"
                        : view === "sandbox"
                          ? "Sandbox lab"
                          : "Settings & consent"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="demo-label">
              {opportunity?.demo ? "FICTIONAL DEMO" : "LIVE WORKSPACE"}
            </span>
            <button
              className="icon-button"
              aria-label="Privacy and help"
              onClick={() => navigate("settings")}
            >
              <CircleHelp size={18} />
            </button>
            <span className="mini-avatar">JD</span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => void load()}>Retry connection</button>
            </div>
          )}
          {activeClaim && claim && opportunity ? (
            <ClaimReview
              state={state}
              claim={claim}
              entitlement={opportunity}
              busy={busy}
              mutate={mutate}
              onBack={() => setActiveClaim(null)}
            />
          ) : activeClaim ? (
            <div className="empty-state">
              <FileText />
              <h2>{ready ? "Claim not found" : "Loading claim…"}</h2>
              <button className="button secondary" onClick={() => setActiveClaim(null)}>
                Back to workspace
              </button>
            </div>
          ) : view === "discover" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="line-accent" />
                    YOUR RECOVERY STARTS HERE
                  </div>
                  <h1>
                    Find what’s <span>yours.</span>
                  </h1>
                  <p>Discover opportunities. Understand the evidence. Stay in control.</p>
                </div>
                <button
                  disabled={!ready || busy || state.run?.status === "running"}
                  className="button primary"
                  onClick={() => setResearchDialog(true)}
                >
                  {state.run?.status === "running" ? (
                    <Loader2 className="spin" size={17} />
                  ) : (
                    <Radar size={17} />
                  )}
                  Run discovery
                  <ArrowUpRight size={16} />
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={async () => {
                    const next = await mutate("start-demo", {});
                    if (next) {
                      setActiveClaim(next.claims[0]!.id);
                    }
                  }}
                >
                  Try guided demo
                </button>
              </div>
              <div className="metrics">
                <div className="metric">
                  <div>
                    <span>Potential value</span>
                    <Wallet size={17} />
                  </div>
                  <strong>
                    {total ? money(total) : "—"}
                    <small>up to</small>
                  </strong>
                  <p>Source estimates · not guaranteed</p>
                </div>
                <div className="metric">
                  <div>
                    <span>Open opportunities</span>
                    <Compass size={17} />
                  </div>
                  <strong>
                    {state.entitlements
                      .filter(
                        (e) => !e.demo && e.track === track && !state.dismissed.includes(e.id),
                      )
                      .length.toString()
                      .padStart(2, "0")}
                    <small>to explore</small>
                  </strong>
                  <p>Based on your selected track</p>
                </div>
                <div className="metric">
                  <div>
                    <span>Claims in progress</span>
                    <FileCheck2 size={17} />
                  </div>
                  <strong>
                    {state.claims.length.toString().padStart(2, "0")}
                    <small>in your workspace</small>
                  </strong>
                  <p>
                    {state.claims.filter((c) => c.status === "ready_to_sign").length} ready for your
                    review
                  </p>
                </div>
              </div>
              <div className="discovery-layout">
                <section className="opportunities">
                  <div className="track-grid">
                    {TRACKS.map((t, i) => {
                      const Icon = [Scale, Wallet, Ticket][i]!;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTrack(t.id)}
                          className={`track-card ${track === t.id ? "active" : ""}`}
                        >
                          <div>
                            <Icon size={20} />
                            <span>
                              {String(
                                state.entitlements.filter((e) => !e.demo && e.track === t.id)
                                  .length,
                              ).padStart(2, "0")}
                            </span>
                          </div>
                          <strong>{t.name}</strong>
                          <small>{t.description}</small>
                        </button>
                      );
                    })}
                  </div>
                  <div className="list-heading">
                    <h2>
                      Your opportunities <span>{visible.length}</span>
                    </h2>
                    <label className="sort-label">
                      <SlidersHorizontal size={14} />
                      <select
                        aria-label="Sort opportunities"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="recommended">Recommended</option>
                        <option value="value">Highest value</option>
                        <option value="deadline">Closest deadline</option>
                      </select>
                    </label>
                  </div>
                  <div className="filter-row">
                    <Tabs value={filter} onValueChange={setFilter}>
                      <TabsList className="filter-tabs">
                        <TabsTrigger value="all">All matches</TabsTrigger>
                        <TabsTrigger value="no-proof">No proof required</TabsTrigger>
                        <TabsTrigger value="saved">Saved</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <div className="search-input">
                      <Search size={15} />
                      <input
                        aria-label="Search opportunities"
                        placeholder="Search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="sample-banner">
                    <FlaskConical size={14} />
                    <span>
                      Live sources only. Eligibility and payment amounts require your review.
                    </span>
                  </div>
                  <div className="opportunity-list">
                    {visible.map((e, index) => (
                      <OpportunityCard
                        key={e.id}
                        entitlement={e}
                        index={index}
                        saved={state.saved.includes(e.id)}
                        disabled={!ready || busy}
                        onSave={() => void mutate("save", { id: e.id })}
                        onDismiss={async () => {
                          if (await mutate("dismiss", { id: e.id }))
                            toast.success("Dismissed. SCOUT will remember this.");
                        }}
                        onStart={() => void start(e)}
                        onDetails={() => setDetail(e)}
                      />
                    ))}
                  </div>
                  {visible.length === 0 && (
                    <div className="empty-state">
                      <Search />
                      <h3>No matches here</h3>
                      <p>Try another filter or run discovery for fresh sources.</p>
                      <button
                        className="button secondary"
                        onClick={() => {
                          setFilter("all");
                          setSearch("");
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                  <div className="list-footer">
                    <ShieldCheck size={14} />
                    No automatic submissions. No share of your recovery.
                  </div>
                </section>
                <aside className="right-rail">
                  <AgentPanel state={state} />
                  <section className="rail-panel">
                    <div className="panel-title">
                      <h3>Your sources</h3>
                      <button
                        aria-label="Manage sources"
                        className="icon-button"
                        onClick={() => navigate("settings")}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="source-row">
                      <span className="source-icon">
                        <Mail size={17} />
                      </span>
                      <div>
                        Email receipts<small>Connect with scoped consent</small>
                      </div>
                      <span className="source-state">Not connected</span>
                    </div>
                    <div className="source-row">
                      <span className="source-icon">
                        <FolderLock size={17} />
                      </span>
                      <div>
                        Evidence vault<small>{state.evidence.length} documents added</small>
                      </div>
                      <button className="text-button" onClick={() => navigate("vault")}>
                        Open
                      </button>
                    </div>
                    <button className="button secondary full" onClick={() => navigate("settings")}>
                      <Plus size={15} />
                      Manage sources
                    </button>
                  </section>
                  <section className="memory-callout">
                    <BrainCircuit size={22} />
                    <h3>It gets to know you.</h3>
                    <p>
                      Dismiss a match or set a preference. Your next discovery gets a little more
                      relevant.
                    </p>
                    <button onClick={() => navigate("memory")}>
                      Explore agent memory <ArrowRight size={15} />
                    </button>
                  </section>
                  <div className="powered">
                    <span>BUILT WITH</span>
                    <div>
                      you.com <i /> CrewAI <i /> Daytona
                    </div>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <UtilityViews
              view={view}
              state={state}
              mutate={mutate}
              busy={busy}
              onOpenClaim={setActiveClaim}
              onDiscover={() => navigate("discover")}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>
            FYOUMONEY <b>/</b> SERAPH SYSTEMS
          </span>
          <span>Evidence first. Always.</span>
          <span>
            <LockKeyhole size={12} />
            You attest. You submit.
          </span>
        </footer>
      </div>
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="claimant-dialog">
          <DialogHeader>
            <span className="eyebrow">{detail?.demo ? "SYNTHETIC EXAMPLE" : "LIVE RESEARCH"}</span>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>{detail?.summary}</DialogDescription>
          </DialogHeader>
          {detail && (
            <>
              <div className="definition">
                <span className="eyebrow">CLASS DEFINITION / TERMS</span>
                <blockquote>{detail.classDefinition}</blockquote>
              </div>
              <h3>What still needs checking</h3>
              {detail.predicates.map((p) => (
                <div className="requirement" key={p.id}>
                  <CircleHelp size={17} />
                  <div>
                    {p.text}
                    <small>{p.reasoning}</small>
                  </div>
                </div>
              ))}
              <div className="source-links">
                {detail.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                    <ArrowUpRight size={14} />
                  </a>
                ))}
                {detail.demo && <p>No official links: this opportunity is fictional.</p>}
              </div>
              <button disabled={busy} className="button primary" onClick={() => void start(detail)}>
                Prepare claim
                <ArrowRight size={16} />
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={researchDialog} onOpenChange={setResearchDialog}>
        <DialogContent className="claimant-dialog">
          <DialogHeader>
            <span className="eyebrow">SCOUT / RESEARCH</span>
            <DialogTitle>A fresh look at what’s available.</DialogTitle>
            <DialogDescription>
              Research all three tracks—class actions, rebates & redemptions, and coupons &
              deals—using You.com. The search covers current US opportunities. No purchase history
              is assumed.
            </DialogDescription>
          </DialogHeader>
          <div className="privacy-block">
            <ShieldCheck size={22} />
            <p>
              Only public search categories and the current date leave the workspace. Names, email
              addresses, receipts and account numbers are never sent to You.com.
            </p>
          </div>
          <p className="muted">
            Live findings remain unverified until their requirements and your evidence are reviewed.
            This request uses your You.com credits.
          </p>
          <button
            disabled={!state.integrations.you || busy}
            className="button primary"
            onClick={() => void scout()}
          >
            <Radar size={17} />
            {state.integrations.you
              ? "Allow research & start live discovery"
              : "You.com key not configured"}
          </button>
        </DialogContent>
      </Dialog>
      <Toaster theme="dark" position="bottom-right" richColors />
    </div>
  );
}
function OpportunityCard({
  entitlement: e,
  index,
  saved,
  disabled,
  onSave,
  onDismiss,
  onStart,
  onDetails,
}: {
  entitlement: Entitlement;
  index: number;
  saved: boolean;
  disabled: boolean;
  onSave: () => void;
  onDismiss: () => void;
  onStart: () => void;
  onDetails: () => void;
}) {
  return (
    <article className="opportunity-card" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="opportunity-top">
        <div className={`merchant-mark merchant-${index % 3}`}>{e.merchant.slice(0, 1)}</div>
        <div className="opportunity-name">
          <div className="card-eyebrow">
            {e.category}
            <span>{e.demo ? "EXAMPLE" : "LIVE SOURCE"}</span>
          </div>
          <h3>{e.title}</h3>
        </div>
        <button
          className={`icon-button bookmark ${saved ? "saved" : ""}`}
          aria-label={saved ? `Unsave ${e.title}` : `Save ${e.title}`}
          disabled={disabled}
          onClick={onSave}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="opportunity-values">
        <strong>
          {e.payoutHigh ? `${money(e.payoutLow)} – ${money(e.payoutHigh)}` : "Not published"}
          <small>estimated value</small>
        </strong>
        <span>
          <Clock3 size={14} />
          {e.effort} min
        </span>
        <span className="deadline">Closes {shortDate(e.deadline)}</span>
        <span className={`confidence ${e.confidence}`}>
          {e.confidence === "likely"
            ? "Likely match"
            : e.confidence === "possible"
              ? "Possible match"
              : "Needs review"}
        </span>
      </div>
      <div className="why-you">
        <Sparkles size={15} />
        <p>
          <strong>Why this surfaced</strong> {e.whyYou}
        </p>
      </div>
      <div className="card-actions">
        <div>
          <button className="button compact primary" disabled={disabled} onClick={onStart}>
            Prepare claim
            <ArrowRight size={14} />
          </button>
          <button className="button compact ghost" disabled={disabled} onClick={onDismiss}>
            Not for me
          </button>
        </div>
        <button className="text-button" onClick={onDetails}>
          View briefing
          <ArrowUpRight size={14} />
        </button>
      </div>
    </article>
  );
}
function AgentPanel({ state }: { state: Workspace }) {
  const run = state.run;
  return (
    <section className="rail-panel agent-panel">
      <div className="panel-title">
        <h3>
          <Radar size={17} />
          Scout activity
        </h3>
        <span className={`agent-status ${run?.status === "running" ? "running" : ""}`}>
          {run?.status === "running"
            ? "Researching"
            : run?.status === "failed"
              ? "Attention"
              : "Standing by"}
        </span>
      </div>
      <div className="agent-visual">
        <div className={`radar-orbit ${run?.status === "running" ? "sweeping" : ""}`}>
          <div />
          <div />
          <Radar size={29} />
        </div>
        <span>{run?.mode === "live" ? "You.com research" : "Your research agent"}</span>
      </div>
      <div className="activity-list" aria-live="polite">
        {run ? (
          run.events.map((message, i) => (
            <div className="activity" key={`${i}-${message}`}>
              <span className="activity-dot" />
              <div>
                {message}
                <small>
                  {i === run.events.length - 1 && run.status === "running"
                    ? "In progress"
                    : run.mode === "demo"
                      ? "Demo event"
                      : "Research event"}
                </small>
              </div>
            </div>
          ))
        ) : (
          <>
            <div className="activity">
              <span className="activity-dot" />
              <div>
                Choose a track to begin<small>Search official sources</small>
              </div>
            </div>
            <div className="activity muted">
              <span className="activity-dot" />
              <div>
                Evidence before assumptions<small>Every live finding carries sources</small>
              </div>
            </div>
          </>
        )}{" "}
        {run?.error && <p className="error-text">{run.error}</p>}
      </div>
      <div className="agent-bottom">
        <LockKeyhole size={13} />
        Personal documents stay private
      </div>
    </section>
  );
}
