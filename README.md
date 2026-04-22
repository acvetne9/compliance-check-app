# AndreasGPT — Healthcare Compliance Checker

**[Live Demo](https://andreasgpt.vercel.app)**

An AI-powered compliance automation platform that checks organizational policies against regulatory requirements. Upload a compliance document, select policies, and get a detailed breakdown of which requirements are met, not met, or unclear — with evidence quotes and reasoning for every determination.

## How It Works

### Core Workflow

1. **Ingest policies** — Upload policy PDFs, which get stored in Vercel Blob, text-extracted, chunked (600 tokens with 50-token overlap, section-aware), and summarized by Claude Haiku.
2. **Upload a compliance document** — A checklist-style or unstructured doc with discrete requirements (e.g., "Does the policy address X?").
3. **Run a compliance check** — Claude extracts requirements from the compliance doc, then evaluates each requirement against each selected policy's chunks, producing a status (`met` / `not_met` / `unclear` / `not_applicable`) with evidence quotes and reasoning.
4. **View results** — Split-pane UI with PDF preview and results breakdown, filterable by gaps.

### Architecture

```
Upload PDF ──> Vercel Blob ──> Extract Text ──> Chunk (section-aware)
                                                      │
                                              Summarize via Haiku
                                                      │
                                                      v
Compliance Doc ──> Extract Requirements (structured output)
                          │
                          v
              For each requirement x policy:
              ┌─ Cache hit? ──> Use cached result
              └─ Cache miss? ──> Claude Haiku check ──> Cache result
                                       │
                                       v
                              Stream results via SSE
```

## Efficiency

The app is designed to run within Anthropic's Tier 1 rate limits (50 RPM, 50K input tokens/min) without sacrificing accuracy.

### Prompt Caching
The policy text is sent as a cacheable system message. The first requirement checked against a policy pays the full input token cost. All subsequent requirements against the same policy reuse the cached prompt, reducing input to just the requirement text (~200 tokens instead of ~30K).

### Semantic Chunk Filtering
Before sending policy text to the model, chunks are filtered by keyword overlap with all requirements. Irrelevant sections (e.g., revision history, board actions) are removed. This reduces input tokens for long policies while preserving prompt caching — the filtered text is the same for all requirements against that policy.

### Cross-Run Caching
Results are cached by `requirementHash + policyId` in the database. Re-running the same compliance document against the same policies skips the API entirely and returns cached results instantly. Only novel requirement-policy pairs hit the API.

### Rate Limiting
Requests are batched (5 concurrent) with a 6.5-second delay between batches, staying under the 50 RPM limit. Exponential backoff (5s, 15s, 45s) handles transient rate limit errors.

### Boilerplate Filtering
Regex patterns strip revision history, board actions, and regulatory approval boilerplate from policy chunks before they reach the model, saving tokens on every request.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| AI | Claude Haiku 4.5 via Vercel AI SDK |
| Database | Neon Postgres + Drizzle ORM |
| Storage | Vercel Blob (PDFs) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 20+
- Anthropic API key
- Neon Postgres database
- Vercel Blob storage token

### Setup

```bash
npm install
cp .env.example .env.local  # Add your API keys
npx drizzle-kit push         # Create database tables
```

### Seed Policies

```bash
npx dotenv -e .env.local -- npx tsx scripts/seed-policies.ts
```

### Development

```bash
npm run dev
```

### Testing

```bash
npm test
```
