# SubSpace Automated Outreach Pipeline

A Node.js command-line pipeline that takes a seed company domain, discovers lookalike companies, finds decision-makers, enriches contacts with verified emails, pauses for human approval, and sends personalized outreach through Brevo.

The project was built for the automated outreach assignment flow:

```text
Seed Domain
  -> Ocean.io Lookalike Companies
  -> Prospeo Decision-Maker Search
  -> Prospeo Email Enrichment
  -> Human Safety Checkpoint
  -> Brevo Email Delivery
```

> Note: the assignment names Eazyreach as the enrichment provider. The current implementation file is named `stage3_eazyreach.js`, but it currently uses Prospeo's enrichment API.

## Features

- End-to-end CLI workflow from one company domain.
- Ocean.io lookalike company discovery.
- Prospeo executive/contact search.
- Prospeo verified email enrichment.
- Lead deduplication and basic deliverability filtering.
- Human approval checkpoint before any email is sent.
- Brevo transactional email delivery.
- Demo-mode support for mocked Prospeo/enrichment/delivery stages.
- Console logging with clear stage-by-stage progress.

## Project Structure

```text
.
├── src
│   ├── config
│   │   └── environment.js
│   ├── stages
│   │   ├── stage1_ocean.js
│   │   ├── stage2_prospeo.js
│   │   ├── stage3_eazyreach.js
│   │   └── stage4_brevo.js
│   ├── utils
│   │   ├── checkpoint.js
│   │   ├── logger.js
│   │   └── resilience.js
│   └── index.js
├── test-prospeo.js
├── package.json
└── README.md
```

## Prerequisites

- Node.js 18 or newer recommended.
- API access for:
  - Ocean.io
  - Prospeo
  - Brevo
- A verified Brevo sender email/domain.

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root:

```env
OCEAN_API_KEY=your_ocean_api_key
PROSPEO_API_KEY=your_prospeo_api_key
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=you@yourdomain.com
BREVO_SENDER_NAME=Your Name

NODE_ENV=development
SEED_DOMAIN=stripe.com
DEMO_MODE=false
```

Required by the current config loader:

- `OCEAN_API_KEY`
- `PROSPEO_API_KEY`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`

Optional:

- `SEED_DOMAIN`: fallback domain if no CLI domain is provided.
- `DEMO_MODE=true`: returns mock Prospeo leads, mock enriched contacts, and simulates Brevo delivery.

## Usage

Run with a domain:

```bash
node src/index.js stripe.com
```

Or run without an argument and enter the domain interactively:

```bash
node src/index.js
```

The pipeline will:

1. Query Ocean.io for lookalike companies.
2. Deduplicate and limit target domains.
3. Search Prospeo for decision-makers.
4. Enrich selected leads with verified emails.
5. Show a review table.
6. Ask for explicit approval.
7. Send emails through Brevo only if approved.

## Demo Mode

Enable demo mode in `.env`:

```env
DEMO_MODE=true
```

In the current implementation:

- Stage 2 returns mock executive contacts.
- Stage 3 returns mock verified emails.
- Stage 4 simulates email delivery.
- Stage 1 still calls Ocean.io, so `OCEAN_API_KEY` is still required.

## Safety Checkpoint

Before delivery, the CLI prints a table containing:

- Company domain
- Contact name
- Job title
- Resolved email address

Emails are sent only when the user explicitly enters `y` or `yes`. Any other input safely aborts delivery.

## Reliability Notes

Current safeguards:

- Domain deduplication.
- Email deduplication.
- Verified-email-only filtering.
- Per-domain and per-lead error handling.
- Basic throttling between API calls.
- Human approval before email delivery.

Known limitations:

- No persistent database or resume support.
- No pagination for large result sets.
- No exponential backoff or retry budget.
- No suppression list or unsubscribe handling.
- Demo mode does not mock Ocean.io.
- `stage3_eazyreach.js` uses Prospeo enrichment instead of Eazyreach.

## External APIs

### Ocean.io

Used for lookalike company discovery.

Endpoint:

```text
POST https://api.ocean.io/v3/search/companies
```

### Prospeo Search

Used to find people at discovered company domains.

Endpoint:

```text
POST https://api.prospeo.io/search-person
```

### Prospeo Enrichment

Used to enrich selected people with verified work emails.

Endpoint:

```text
POST https://api.prospeo.io/enrich-person
```

### Brevo

Used for transactional outreach email delivery.

Endpoint:

```text
POST https://api.brevo.com/v3/smtp/email
```

## Development Notes

Useful local files:

- `INTERVIEW_WALKTHROUGH.md`: deep technical walkthrough and interview-prep notes.
- `process.txt`: original implementation plan.
- `test-prospeo.js`: standalone Prospeo API smoke test.

Run the Prospeo smoke test:

```bash
node test-prospeo.js
```

## Security Notes

- Keep `.env` out of Git.
- Do not print or share API keys.
- Use demo mode for walkthroughs whenever possible.
- Review all resolved recipients at the checkpoint before approving delivery.
- Prefer a test/sandbox Brevo account for demos.

## Future Improvements

- Add real Eazyreach integration or rename Stage 3 to Prospeo enrichment.
- Add CLI flags for domain, max companies, max leads, and dry-run mode.
- Add `npm` scripts for start, demo, and smoke tests.
- Add retry logic with exponential backoff and jitter.
- Add pagination support for Ocean.io and Prospeo.
- Add a database for runs, contacts, enrichments, approvals, and sends.
- Add unsubscribe and suppression-list handling.
- Add structured logging and secret redaction.
