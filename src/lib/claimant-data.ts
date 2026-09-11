export type TrackId = "class-actions" | "redemptions" | "coupons";

export type Track = {
  id: TrackId;
  name: string;
  blurb: string;
  detail: string;
  available: boolean;
};

export const TRACKS: Track[] = [
  {
    id: "class-actions",
    name: "Class actions & settlements",
    blurb: "Money set aside for people like you, waiting on a signed claim.",
    detail:
      "Live in this version. Scout searches open settlements, court dockets and administrator sites, then explains why you may qualify.",
    available: true,
  },
  {
    id: "redemptions",
    name: "Redemptions & rebates",
    blurb: "Unclaimed property, deposits and manufacturer rebates.",
    detail: "Planned for a later release.",
    available: false,
  },
  {
    id: "coupons",
    name: "Coupons & deals",
    blurb: "Merchant-owned offers, no aggregator spam.",
    detail: "Planned for a later release.",
    available: false,
  },
];

export type Entitlement = {
  id: string;
  title: string;
  administrator: string;
  whatItIs: string;
  whyYouQualify: string[];
  estimate: string;
  estimateBasis: string;
  proofNeeded: string[];
  deadline: string;
  confidence: "strong" | "possible" | "long shot";
  sources: { label: string; url: string }[];
};

export const ENTITLEMENTS: Entitlement[] = [
  {
    id: "streamco-data",
    title: "StreamCo data-sharing settlement",
    administrator: "Larkin Claims Administration",
    whatItIs:
      "StreamCo agreed to a $62m fund after sharing viewing history with advertisers without consent. Anyone with an account between 2019 and 2023 can claim a cash share.",
    whyYouQualify: [
      "You held a paid StreamCo account during the covered window.",
      "No purchase receipt is required — an account email is enough.",
      "The class is nationwide, so your state does not exclude you.",
    ],
    estimate: "$34 – $90",
    estimateBasis:
      "Fund size divided by expected claim rate. The real figure lands after the claims window closes.",
    proofNeeded: ["The email address on the account", "Approximate sign-up year"],
    deadline: "14 November 2026",
    confidence: "strong",
    sources: [
      { label: "Settlement website", url: "https://example.com/streamco-settlement" },
      { label: "Court docket entry", url: "https://example.com/docket/streamco" },
    ],
  },
  {
    id: "northbank-fees",
    title: "Northbank overdraft fee settlement",
    administrator: "Verity Settlement Services",
    whatItIs:
      "A $19.5m fund for customers charged repeat overdraft fees on the same transaction between 2018 and 2022.",
    whyYouQualify: [
      "You appear to have banked with Northbank during the covered period.",
      "Repeat-fee patterns are common on the account type you used.",
    ],
    estimate: "$25 – $210",
    estimateBasis: "Paid per fee charged, so it depends on your statement history.",
    proofNeeded: [
      "A statement showing at least one repeat overdraft fee",
      "The last four digits of the account",
    ],
    deadline: "2 October 2026",
    confidence: "possible",
    sources: [{ label: "Administrator notice", url: "https://example.com/northbank" }],
  },
  {
    id: "brightleaf-labels",
    title: "Brightleaf mislabeled supplements",
    administrator: "Cordell Claims Group",
    whatItIs:
      "Buyers of Brightleaf vitamins sold as 'clinically proven' can claim a refund of up to three purchases without a receipt.",
    whyYouQualify: [
      "The product line was widely sold at retailers you shop.",
      "Claims without receipts are capped but still allowed.",
    ],
    estimate: "$12 – $36",
    estimateBasis: "Flat per-unit refund, capped at three units without proof of purchase.",
    proofNeeded: ["A signed statement of purchase", "Receipt if you have one, for a higher cap"],
    deadline: "20 January 2027",
    confidence: "long shot",
    sources: [{ label: "Settlement website", url: "https://example.com/brightleaf" }],
  },
];

export function getEntitlement(id: string) {
  return ENTITLEMENTS.find((e) => e.id === id);
}

export type StepState = "done" | "active" | "waiting on you" | "waiting on them" | "blocked";

export type ClaimStep = {
  key: string;
  title: string;
  summary: string;
  detail: string;
  actor: "agent" | "you" | "administrator";
};

export const CLAIM_STEPS: ClaimStep[] = [
  {
    key: "eligibility",
    title: "Check eligibility",
    summary: "We read the settlement terms and check them against what we know about you.",
    detail:
      "Nothing personal leaves the platform during this step. The result is a plain-language answer with the exact clause it came from.",
    actor: "agent",
  },
  {
    key: "evidence",
    title: "Gather evidence",
    summary: "We collect the proof the administrator asks for.",
    detail:
      "You choose which documents to add. We only look for the specific items listed, never your whole inbox.",
    actor: "agent",
  },
  {
    key: "draft",
    title: "Draft the claim",
    summary: "Every field on the claim form is filled in for you.",
    detail: "You can edit any answer before it goes anywhere.",
    actor: "agent",
  },
  {
    key: "attest",
    title: "Read, confirm and sign",
    summary: "You check the claim is true and sign it yourself.",
    detail:
      "This is the one step nobody can do for you. Signing is what makes the claim yours and keeps the payout coming straight to you.",
    actor: "you",
  },
  {
    key: "submit",
    title: "Send it in",
    summary: "The signed claim goes to the administrator with a delivery receipt.",
    detail: "You get a copy of exactly what was sent, and the confirmation number when it lands.",
    actor: "you",
  },
  {
    key: "track",
    title: "Track the payout",
    summary: "We watch for replies and chase the deadline dates.",
    detail:
      "If the administrator asks a question, you hear about it. If nothing arrives, you get their contact details and the docket number.",
    actor: "administrator",
  },
];
