/** Shared domain contracts. Provider credentials must stay in server modules. */
export type TrackId = "class_action" | "redemption" | "coupon";
export type View = "discover" | "tracker" | "vault" | "memory" | "settings" | "sandbox";
export interface Predicate {
  id: string;
  text: string;
  status: "supported" | "unsupported" | "user_assertion_required" | "contradicted";
  sourceQuote: string;
  reasoning: string;
  evidenceIds: string[];
}
export interface Entitlement {
  id: string;
  title: string;
  merchant: string;
  category: string;
  track: TrackId;
  administrator: string;
  summary: string;
  whyYou: string;
  payoutLow: number;
  payoutHigh: number;
  payoutBasis: string;
  deadline: string | null;
  confidence: "likely" | "possible" | "needs_review";
  effort: number;
  proofRequired: boolean;
  classDefinition: string;
  officialUrl: string | null;
  sources: { title: string; url: string }[];
  predicates: Predicate[];
  demo: boolean;
}
export interface Evidence {
  id: string;
  name: string;
  kind: string;
  source: string;
  sha256: string;
  size: number;
  createdAt: string;
  demo: boolean;
}
export type ClaimStatus =
  "analyzing" | "needs_evidence" | "ready_to_sign" | "parked" | "attested" | "submitted";
export interface Claim {
  preparationEvents?: string[];
  id: string;
  entitlementId: string;
  status: ClaimStatus;
  evidenceIds: string[];
  createdAt: string;
  packetHash: string;
  typedName: string | null;
  signedAt: string | null;
  confirmation: string | null;
  gmailDraftId?: string;
  gmailDraftVersion?: number;
}
export interface Memory {
  id: string;
  kind: "preference" | "rejection" | "outcome";
  content: string;
  createdAt: string;
}
export interface AuditEvent {
  id: string;
  agent: "SCOUT" | "FILER" | "CONDUIT" | "YOU";
  message: string;
  at: string;
}
export interface ScoutRun {
  id: string;
  status: "running" | "completed" | "failed";
  mode: "demo" | "live";
  events: string[];
  error: string | null;
}
export interface Workspace {
  entitlements: Entitlement[];
  claims: Claim[];
  evidence: Evidence[];
  memories: Memory[];
  dismissed: string[];
  saved: string[];
  events: AuditEvent[];
  minimumPayout: number;
  researchConsent: boolean;
  run: ScoutRun | null;
  integrations: { you: boolean; crewai: boolean; daytona: boolean; conduit: boolean };
}
export const TRACKS = [
  {
    id: "class_action" as const,
    name: "Class actions",
    description: "Settlements worth a closer look",
  },
  {
    id: "redemption" as const,
    name: "Rebates & redemptions",
    description: "Find the value left behind",
  },
  { id: "coupon" as const, name: "Coupons & deals", description: "Offers from brands you use" },
];
const statement = (id: string, text: string): Predicate => ({
  id,
  text,
  status: "user_assertion_required",
  sourceQuote: text,
  reasoning: "Only you can confirm this fact. Sample records do not establish eligibility.",
  evidenceIds: [],
});
export const DEMO_ENTITLEMENTS: Entitlement[] = [
  {
    id: "demo-streamco",
    title: "StreamCo privacy settlement",
    merchant: "StreamCo",
    category: "Digital privacy",
    track: "class_action",
    administrator: "Example Claims Administration",
    summary:
      "A fictional settlement for subscribers whose viewing activity was shared with advertising partners. This example demonstrates claim preparation.",
    whyYou:
      "Your sample profile includes a streaming subscription during the covered period. Account ownership and use still need your confirmation.",
    payoutLow: 34,
    payoutHigh: 90,
    payoutBasis: "Illustrative pro-rata estimate. Payments are not guaranteed.",
    deadline: "2026-11-14",
    confidence: "likely",
    effort: 6,
    proofRequired: false,
    classDefinition:
      "Synthetic example: US residents who held a paid StreamCo account between January 2019 and December 2023 and viewed content in that period.",
    officialUrl: null,
    sources: [],
    predicates: [
      statement(
        "account",
        "You held a paid StreamCo account between January 2019 and December 2023.",
      ),
      statement("resident", "You were a United States resident during the covered period."),
      statement("viewing", "You viewed content using that account during the covered period."),
    ],
    demo: true,
  },
  {
    id: "demo-northbank",
    title: "Northbank repeat-fee settlement",
    merchant: "Northbank",
    category: "Banking & finance",
    track: "class_action",
    administrator: "Example Settlement Services",
    summary:
      "A fictional claim for repeat overdraft fees. A statement identifying the fee is required.",
    whyYou:
      "Your sample profile includes banking activity in the relevant years. A matching statement has not been found.",
    payoutLow: 25,
    payoutHigh: 210,
    payoutBasis: "Illustrative amount depends on documented fees.",
    deadline: "2026-10-02",
    confidence: "possible",
    effort: 12,
    proofRequired: true,
    classDefinition:
      "Synthetic example: account holders charged repeat overdraft fees on the same transaction between 2018 and 2022.",
    officialUrl: null,
    sources: [],
    predicates: [
      {
        ...statement("fees", "A statement documents repeated fees on the same transaction."),
        status: "unsupported",
        reasoning: "No matching bank statement is attached.",
      },
      statement("owner", "You owned the affected account."),
    ],
    demo: true,
  },
  {
    id: "demo-brightleaf",
    title: "Brightleaf product labeling",
    merchant: "Brightleaf",
    category: "Consumer products",
    track: "class_action",
    administrator: "Example Claims Group",
    summary: "A fictional labeling settlement for a specified supplement purchase.",
    whyYou:
      "Your sample purchase categories overlap with this product. No actual purchase has been verified.",
    payoutLow: 12,
    payoutHigh: 36,
    payoutBasis: "Illustrative fixed amount per purchase.",
    deadline: "2027-01-20",
    confidence: "needs_review",
    effort: 5,
    proofRequired: false,
    classDefinition:
      "Synthetic example: personal-use purchasers of Brightleaf supplements between 2020 and 2023.",
    officialUrl: null,
    sources: [],
    predicates: [
      statement(
        "purchase",
        "You purchased the covered supplement for personal use between 2020 and 2023.",
      ),
    ],
    demo: true,
  },
  {
    id: "demo-rebate",
    title: "Home appliance energy rebate",
    merchant: "Northstar Home",
    category: "Home & energy",
    track: "redemption",
    administrator: "Example Rebate Center",
    summary: "A synthetic manufacturer rebate requiring a dated purchase receipt.",
    whyYou:
      "Home purchases appear in the sample profile. The model and purchase date need documentary support.",
    payoutLow: 50,
    payoutHigh: 150,
    payoutBasis: "Illustrative rebate varies by model.",
    deadline: "2026-12-31",
    confidence: "possible",
    effort: 8,
    proofRequired: true,
    classDefinition: "Synthetic example: purchase of an eligible appliance in 2026.",
    officialUrl: null,
    sources: [],
    predicates: [
      {
        ...statement("receipt", "Your receipt identifies an eligible model purchased in 2026."),
        status: "unsupported",
      },
    ],
    demo: true,
  },
  {
    id: "demo-offer",
    title: "A little back on your next order",
    merchant: "Everyday Market",
    category: "Everyday essentials",
    track: "coupon",
    administrator: "Example Merchant",
    summary: "A synthetic merchant offer. No redeemable code is provided.",
    whyYou: "Grocery shopping is included in the sample profile. Offer restrictions need review.",
    payoutLow: 5,
    payoutHigh: 15,
    payoutBasis: "Illustrative discount, not cash recovery.",
    deadline: null,
    confidence: "possible",
    effort: 2,
    proofRequired: false,
    classDefinition: "Synthetic example: a qualifying future grocery order.",
    officialUrl: null,
    sources: [],
    predicates: [statement("terms", "You reviewed the merchant offer restrictions.")],
    demo: true,
  },
];
export const statusLabel: Record<ClaimStatus, string> = {
  analyzing: "CrewAI is preparing",
  needs_evidence: "Needs evidence",
  ready_to_sign: "Ready for review",
  parked: "Saved for later",
  attested: "Ready for your submission",
  submitted: "Submission recorded",
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
export const shortDate = (d: string | null) =>
  d
    ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "Not published";
