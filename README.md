# FYOUMONEY

A local hackathon prototype for discovering consumer recovery opportunities, preparing evidence-backed claims and drafting correspondence. Built from the supplied CLAIMANT technical design; product branding is FYOUMONEY.

## Run locally

Requires Node.js 22+, Bun, and Python 3.12 for CrewAI.

```sh
bun install --frozen-lockfile
cp .env.example .env.local
python3.12 -m venv .venv-agent
.venv-agent/bin/pip install -r services/filer/requirements.txt
python3 -m venv .venv
.venv/bin/pip install -r services/filer/requirements-sandbox.txt
```

Configure server-only credentials in `.env.local`, including a random shared `CREWAI_HMAC_SECRET`, then run in separate terminals:

```sh
.venv-agent/bin/python -m uvicorn services.filer.app:app --host 127.0.0.1 --port 8001 --env-file .env.local
node --env-file=.env.local node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000
```

## Features and boundaries

- You.com Search + Research discover all three tracks: class actions, rebates/redemptions and coupons/deals.
- Real CrewAI Flow prepares source-based requirements. Human evidence review and individual attestation remain separate.
- One creates real Gmail drafts; no automatic email sending or claim submission.
- Daytona runs synthetic boundary checks and retains named sandboxes with code/results for inspection. Auto-stop: five minutes; auto-delete disabled.
- Federal/state tax research cites government sources and prominently disclaims professional advice.
- A clearly labeled fictional guided demo provides sample evidence and scripted preparation for a reliable walkthrough.

**Local single-owner preview only.** The backend enforces loopback access, uses private filesystem persistence and an HttpOnly session cookie. Supabase auth/RLS and multi-user mailbox ownership are not implemented. Do not deploy publicly by removing the loopback restriction. No guarantee of eligibility, tax treatment, legal compliance or payment is made. The Z3 model checks selected modeled invariants, not a proof of the entire application.

## Validation

```sh
bun test
bunx tsc --noEmit
bun run lint
bun run build
node scripts/check-secrets.mjs
.venv/bin/python services/filer/verify_model.py
```

[Demo walkthrough](docs/demo-runbook.md) · [Live integrations](docs/live-integrations.md) · [Tax research](docs/tax-research.md) · [Artwork](docs/brand-artwork.md)

---

## Original project context

# Skill Setup Helper

read and set up https://you.com/SKILL.md

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a6f10bbf-3df8-4b36-be3b-e68a5177c2df).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
