# Automated Outreach Pipeline: Technical Interview Walkthrough

This document explains the project as a senior-engineering code walkthrough. It is written so you can defend the architecture, the implementation details, the integration choices, and the known production gaps during a live technical interview.

Important scope note: this walkthrough covers the authored project files and project-level artifacts. It does not line-by-line explain generated dependency files inside `node_modules`, because those are third-party installed packages, not application code you authored.

## 1. Project Inventory

### Authored Application Code

- `src/index.js`: Pipeline orchestrator and CLI entrypoint.
- `src/config/environment.js`: Environment-variable loading, required-key validation, and centralized runtime config.
- `src/stages/stage1_ocean.js`: Stage 1 integration with Ocean.io for lookalike company discovery.
- `src/stages/stage2_prospeo.js`: Stage 2 integration with Prospeo person search for decision-maker discovery.
- `src/stages/stage3_eazyreach.js`: Stage 3 email enrichment. Despite the filename, it currently uses Prospeo enrichment, not Eazyreach.
- `src/stages/stage4_brevo.js`: Stage 5 email delivery through Brevo transactional email API. It is named `stage4` because the checkpoint lives in `utils/checkpoint.js`.
- `src/utils/checkpoint.js`: Human safety approval checkpoint before email sending.
- `src/utils/resilience.js`: Shared resilience helpers: deduplication, sleep/throttling, lead hygiene.
- `src/utils/logger.js`: CLI logger with colored stage/info/success/warn/error output.
- `test-prospeo.js`: One-off API test script for Prospeo search.

### Project and Support Files

- `package.json`: Declares the Node project, ESM mode, entrypoint, and dependencies.
- `package-lock.json`: Locks installed dependency versions. It currently disagrees with `package.json` versions and project name.
- `.env`: Runtime secrets and configuration. Values must never be committed or shown; this walkthrough only discusses key names.
- `.gitignore`: Prevents committing dependencies, secrets, local notes, and one-off test script.
- `README.md`: Empty placeholder.
- `process.txt`: Planning/history document describing build phases and intended architecture.
- `SDE Assignment - Automated Outreach Pipeline - Vocallabs.pdf`: Assignment brief. It defines the intended four-service pipeline: Ocean.io, Prospeo, Eazyreach, Brevo, plus optional safety checkpoint.
- `node_modules/`: Installed third-party dependencies; not authored application logic.
- `.agents/` and `.codex/`: Present but contain no files in this workspace.

## 2. Runtime Command: `node src/index.js stripe.com`

### What Actually Happens

The command starts Node and executes `src/index.js`. However, the current implementation does not read `stripe.com` from `process.argv`. Instead, `src/config/environment.js` sets `config.seedDomain` from `process.env.SEED_DOMAIN || 'stripe.com'`.

Interview defense:

- If `.env` contains `SEED_DOMAIN=some-domain.com`, the pipeline uses that value.
- If `SEED_DOMAIN` is absent, it defaults to `stripe.com`.
- The trailing CLI argument `stripe.com` is ignored in the current code.
- A production improvement would parse `process.argv[2]` and fall back to `SEED_DOMAIN`, then to `stripe.com`.

### Actual Execution Order

1. Node loads `src/index.js`.
2. `src/index.js` imports `config` from `src/config/environment.js`.
3. `environment.js` loads `.env` and validates required keys.
4. If required keys are missing, the process exits immediately with code `1`.
5. If config is valid, `runMasterPipeline()` starts.
6. Stage 1 calls Ocean.io and returns lookalike company domains.
7. The orchestrator deduplicates domains and keeps only the first 3.
8. The orchestrator sleeps for 1.5 seconds.
9. Stage 2 calls Prospeo search for each target domain and returns executive leads.
10. The orchestrator keeps only the first 5 leads.
11. Stage 3 calls Prospeo enrichment for each lead and returns only verified-email leads.
12. The orchestrator sanitizes/deduplicates enriched leads.
13. The checkpoint prints a table and asks for confirmation.
14. If approved, Brevo sends personalized emails.
15. If rejected, the pipeline halts without delivery.
16. Any uncaught top-level error is logged by `runMasterPipeline()`.

## 3. File Walkthrough: `src/index.js`

### Purpose

`src/index.js` is the master orchestrator. It wires all stages together and defines the sequential data flow from seed domain to email delivery.

### Why It Exists Architecturally

It centralizes workflow control while keeping vendor-specific API logic in separate stage files. This gives the project a pipeline architecture where every stage receives normalized input and returns normalized output.

### Imports

Lines 1-2 import shared runtime configuration and logging. The orchestrator should not read `.env` directly or call `console.log` everywhere; config and logging are centralized.

Lines 4-7 import each stage:

- `getLookalikeCompanies`: seed domain to domains.
- `getDecisionMakers`: domains to lead records.
- `enrichEmails`: lead records to verified email leads.
- `sendOutreachEmails`: approved leads to sent emails.

Line 9 imports the human checkpoint.

Lines 11-15 import helper functions:

- `deduplicateArray`: removes duplicate domains.
- `sanitizeAndFilterLeads`: removes duplicate or risky leads.
- `sleep`: throttles between expensive API stages.

### Function: `runMasterPipeline()`

Input: no direct function arguments. It reads `config.seedDomain`.

Output: no returned business value. It performs side effects: API calls, logging, user prompt, and email sends.

Errors: The full function body is wrapped in `try/catch`. Any unhandled downstream exception is logged as a critical runtime failure.

Line-by-line behavior:

- Lines 17-18 define and enter an async function inside a `try`.
- Lines 19-22 print Stage 0 initialization.
- Lines 24-26 log the configured seed domain.
- Line 28 prints a divider for CLI readability.
- Lines 34-35 call Ocean.io with `config.seedDomain`.
- Lines 37-38 deduplicate returned domains and slice to 3. This is both a cost-control and demo-scope limit.
- Lines 40-46 log and sleep for 1.5 seconds. This is a coarse throttle before Prospeo.
- Line 52 calls Stage 2 with the target domains.
- Line 54 keeps only the first 5 leads. This is another demo/cost-control limit. It is currently misindented.
- Lines 62-65 log Stage 3.
- Lines 67-68 call email enrichment with those first 5 leads.
- Lines 70-71 sanitize enriched leads by email uniqueness and risk status.
- Lines 78-79 ask the human for final approval.
- Lines 87-97 send emails only if the checkpoint returns `true`.
- Lines 98-102 log a safe halt if the user rejects.
- Lines 103-108 catch top-level failures.
- Line 111 invokes the pipeline.

### Data Flow

Input:

- `config.seedDomain` enters from `.env` or default.

Output:

- Stage side effects: API calls and emails.
- No file output or database persistence.

Data transformations:

- `seedDomain: string`
- `rawDomains: string[]`
- `targetDomains: string[]`
- `leads: Lead[]`
- `identifiedLeads: Lead[]`
- `enrichedLeads: EnrichedLead[]`
- `finalizedLeads: EnrichedLead[]`
- `isAuthorized: boolean`

### Interactions With Other Files

`src/index.js` imports every stage and utility. It is the only file that understands the whole pipeline order. Individual stages do not call each other, which is good separation of concerns.

### Error Handling

The orchestrator catches unhandled errors, but most stage files also catch their own per-service errors and return partial results. This means the pipeline favors graceful degradation over hard failure.

### Reliability Mechanisms

- Domain deduplication after Ocean.io.
- Hard cap of 3 domains.
- Hard cap of 5 leads.
- 1.5-second inter-stage sleep.
- Lead sanitization after enrichment.
- Manual checkpoint before sending.

### Weaknesses

- CLI argument is ignored.
- Hard caps are magic numbers.
- No persistent state or resume behavior.
- Stage numbering is inconsistent: checkpoint logs Stage 4 and Brevo also logs Stage 4.
- No structured metrics.

## 4. File Walkthrough: `src/config/environment.js`

### Purpose

Loads environment variables, validates required secrets, and exports a single `config` object.

### Why It Exists Architecturally

Centralized config avoids scattering `process.env` throughout the project. This makes API key handling easier to audit and helps the app fail fast if required credentials are missing.

### Important Blocks

Lines 1-3 import:

- `dotenv`: loads `.env` into `process.env`.
- `path`: builds filesystem paths.
- `fileURLToPath`: recreates CommonJS-like file paths in ESM.

Lines 5-7 reconstruct `__filename` and `__dirname` because the project uses `"type": "module"` and ES modules do not provide those globals by default.

Line 10 loads `.env` from the project root via `../../.env` relative to `src/config`.

Lines 12-20 define required keys:

- `OCEAN_API_KEY`
- `PROSPEO_API_KEY`
- `EAZYREACH_API_KEY`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`

Lines 23-27 validate that all required keys exist. If any are missing, the app logs a red config error and exits immediately.

Lines 29-42 export normalized config values.

### Function-Like Behavior

There are no exported functions. The module performs work at import time.

Input:

- `.env`
- host environment variables

Output:

- `config` object.
- Possible process termination on missing keys.

### External APIs

No external network API is called here. It uses the `dotenv` package.

### Error Handling

The file fails fast using `process.exit(1)` if required keys are missing. This prevents confusing downstream errors like unauthorized API calls.

### Security

Positive:

- Secrets are stored in environment variables.
- `.env` is ignored by Git.
- Code references config keys without hardcoding actual secrets.

Risks:

- `.env` exists locally with real secrets; accidental logs or screenshots could leak them.
- No validation of sender email format.
- `EAZYREACH_API_KEY` is required even though Eazyreach is not actually used.
- `TEST_RECIPIENT` exists in `.env` but is not exported, so test mode in Brevo cannot activate.

### Weaknesses

- Duplicate comment on lines 38-39.
- `isEazyreachMocked` exists but Stage 3 does not use Eazyreach.
- No CLI override support for seed domain.
- Missing `testRecipient: process.env.TEST_RECIPIENT`.

## 5. File Walkthrough: `src/stages/stage1_ocean.js`

### Purpose

Finds companies similar to the seed company using Ocean.io.

### Why It Exists Architecturally

Stage 1 expands one human input into multiple target companies. This is the top-of-funnel sourcing stage.

### Function: `getLookalikeCompanies(seedDomain)`

Input:

- `seedDomain: string`, for example `"stripe.com"`.

Output:

- `Promise<string[]>`, a deduplicated list of discovered company domains from Ocean.io response data.

External API:

- `POST https://api.ocean.io/v3/search/companies`
- Auth header: `X-Api-Token: config.oceanApiKey`
- JSON body:

```json
{
  "size": 3,
  "companiesFilters": {
    "lookalikeDomains": ["stripe.com"]
  }
}
```

Important code blocks:

- Lines 6-8 log the requested seed domain.
- Lines 11-26 perform the HTTP POST with a 15-second timeout.
- Lines 14-17 request 3 lookalike companies for the seed domain.
- Lines 20-23 attach authentication and JSON content type.
- Line 28 extracts `response.data?.companies` defensively.
- Lines 30-40 validate that `companies` is an array; if not, log schema mismatch and return `[]`.
- Lines 42-48 map each item to `item?.company?.domain`, remove falsy values, and deduplicate with `Set`.
- Lines 50-56 log success and discovered domains.
- Line 58 returns the final domain array.
- Lines 59-73 catch request failures, log status/message, print API error body if present, and return `[]`.

### Data Flow

Input:

- `seedDomain` from `src/index.js`.

Output:

- `domains` array to `src/index.js`.

Next stage usage:

- `src/index.js` deduplicates and slices the returned domains before passing them to Prospeo search.

### Error Handling

The stage is intentionally non-fatal. If Ocean.io fails, it returns an empty array. That means downstream stages receive no domains and eventually produce no sendable leads.

### Reliability Mechanisms

- 15-second timeout.
- Optional chaining for schema safety.
- Schema validation for `companies`.
- Deduplication with `Set`.
- Size limited to 3.

### Weaknesses

- No retry on transient network failure.
- No pagination.
- No validation that `seedDomain` is a valid domain.
- Logs raw API error data, which could include sensitive metadata.
- If Stage 1 returns `[]`, the pipeline still proceeds instead of halting early with a clearer message.

## 6. File Walkthrough: `src/stages/stage2_prospeo.js`

### Purpose

Searches Prospeo for people at each target company and keeps only decision-makers.

### Why It Exists Architecturally

Ocean.io gives companies; the outreach pipeline needs people. Stage 2 converts company domains into contact candidates.

### Local Function: `sleep(ms)`

Input:

- `ms: number`

Output:

- `Promise<void>` that resolves after the timeout.

Why it exists:

- Used to throttle Prospeo requests by 1.5 seconds per domain.

Weakness:

- Duplicates `sleep` from `src/utils/resilience.js`.

### Function: `getDecisionMakers(domains)`

Input:

- `domains: string[]`

Output:

- `Promise<Lead[]>`, where each lead has `domain`, `personId`, `name`, `title`, `linkedin`, and `emailStatus`.

External API:

- `POST https://api.prospeo.io/search-person`
- Auth header: `X-KEY: config.prospeoApiKey`
- JSON body filters by company website.

Important code blocks:

- Lines 9-11 log how many domains will be searched.
- Line 13 initializes `allLeads`, the aggregate output.
- Lines 15-28 define executive title keywords.
- Line 30 loops sequentially over domains. Sequential processing reduces rate-limit risk but slows throughput.
- Lines 31-53 wrap each domain request in `try/catch`, so one failed domain does not kill the whole stage.
- Lines 34-52 call Prospeo search with `page: 1` and a company website include filter.
- Line 55 extracts `response.data?.results || []`.
- Line 57 tracks qualified leads for the current domain.
- Lines 59-95 iterate through raw Prospeo results.
- Line 60 reads `item?.person`.
- Line 62 skips malformed records with no person.
- Lines 64-66 normalize the job title to lowercase.
- Lines 68-70 determine whether the title contains any executive keyword.
- Line 72 skips non-executives.
- Lines 74-92 push a normalized lead object.
- Lines 79-81 choose `full_name` first, then build from first and last name.
- Lines 83-85 default missing title to `"Unknown"`.
- Lines 87-88 set missing LinkedIn to `null`.
- Lines 90-91 preserve any existing email status or default to `"UNKNOWN"`.
- Line 94 increments the per-domain count.
- Lines 97-99 log qualified lead count.
- Line 101 sleeps 1.5 seconds before the next domain.
- Lines 102-127 catch domain-level errors.
- Lines 107-115 print API error body if available.
- Lines 116-125 detect Prospeo rate-limit error code and wait 60 seconds.
- Lines 130-132 log total mined leads.
- Line 134 returns `allLeads`.

### Data Flow

Input:

- `targetDomains` from Stage 1.

Output:

- `allLeads` to `src/index.js`.

Next stage usage:

- `src/index.js` slices to first 5 leads and passes them to `enrichEmails`.
- Stage 3 depends especially on `personId`.

### Error Handling

Failures are isolated per domain. If Prospeo fails for one domain, the loop continues to the next domain. If a rate-limit error is detected, it sleeps 60 seconds and continues.

### Reliability Mechanisms

- Sequential API calls.
- 1.5-second throttle after each successful domain.
- 60-second wait on rate-limit error.
- Defensive optional chaining.
- Title filtering.
- Partial failure tolerance.

### Deduplication and Validation

- No contact-level deduplication in Stage 2.
- No LinkedIn validation.
- No person ID validation beyond Stage 3 skipping missing IDs.
- Executive filtering is keyword-based and can produce false positives or false negatives.

### Weaknesses

- Only requests `page: 1`, so pagination is missing.
- Search query does not filter titles at the API level; filtering is local.
- Rate-limit detection depends on exact string equality: `'Rate limit exceeded'`.
- No retry after the 60-second wait for the same failed request.
- Duplicates `sleep` helper.

## 7. File Walkthrough: `src/stages/stage3_eazyreach.js`

### Purpose

Enriches lead records with verified email addresses.

### Naming Mismatch

The file is named `stage3_eazyreach.js`, and the assignment expects Eazyreach for LinkedIn-to-email enrichment. The implementation actually calls Prospeo's `enrich-person` endpoint using `person_id`. In an interview, be honest:

- The intended architecture has Eazyreach as Stage 3.
- The current working implementation uses Prospeo enrichment because Stage 2 already provides Prospeo `person_id`.
- The `config.isEazyreachMocked` flag hints that Eazyreach was planned or unavailable.

### Local Function: `sleep(ms)`

Input:

- `ms: number`

Output:

- `Promise<void>`

Purpose:

- Throttles enrichment calls by 1 second after successful enrichment.

Weakness:

- Duplicates the shared `sleep`.

### Function: `enrichEmails(leads)`

Input:

- `leads: Lead[]`, expected to contain `personId`, `name`, `domain`, `title`, `linkedin`.

Output:

- `Promise<EnrichedLead[]>`, where each enriched lead includes `email`, verified `emailStatus`, `verificationMethod`, and `enrichmentProvider`.

External API:

- `POST https://api.prospeo.io/enrich-person`
- Auth header: `X-KEY: config.prospeoApiKey`
- JSON body:

```json
{
  "only_verified_email": true,
  "data": {
    "person_id": "..."
  }
}
```

Important code blocks:

- Lines 9-11 log how many leads will be enriched.
- Line 13 initializes `enrichedLeads`.
- Line 15 loops over leads sequentially.
- Lines 16-22 skip leads without `personId`. This prevents calling Prospeo with invalid enrichment input.
- Lines 24-26 log which lead is being enriched.
- Lines 28-43 call Prospeo enrichment with `only_verified_email: true`.
- Line 45 extracts `response.data?.person`.
- Lines 47-49 silently skip if no person object exists.
- Line 51 reads `person.email`.
- Lines 53-61 require `emailData.status === 'VERIFIED'`. Anything missing or non-verified is skipped.
- Lines 63-75 push an enriched lead by spreading the original lead and adding email fields.
- Lines 70-71 preserve the verification method.
- Lines 73-74 label the provider as `PROSPEO_ENRICH`.
- Lines 77-79 log success.
- Line 81 sleeps for 1 second.
- Lines 82-107 catch enrichment errors and handle rate-limit wait.
- Lines 110-112 log verified count.
- Line 114 returns enriched leads.

### Data Flow

Input:

- `identifiedLeads` from Stage 2.

Output:

- Verified enriched leads to `src/index.js`.

Next stage usage:

- `sanitizeAndFilterLeads` deduplicates and risk-filters.
- `runSafetyCheckpoint` displays final leads.
- `sendOutreachEmails` requires `email` and `emailStatus === 'VERIFIED'`.

### Error Handling

Each lead is isolated. A failure enriching one person does not crash the stage. Rate-limit errors cause a 60-second wait.

### Reliability Mechanisms

- Requires `personId`.
- Requests only verified emails.
- Skips missing person records.
- Skips missing or non-verified emails.
- Sequential requests.
- 1-second throttle after success.
- 60-second wait on rate-limit.

### Weaknesses

- Does not use Eazyreach despite filename.
- Does not use LinkedIn URL for enrichment.
- No retry after rate-limit wait.
- No sleep after failed non-rate-limit requests.
- No email format validation.
- Silent `continue` for missing person makes debugging harder.

## 8. File Walkthrough: `src/utils/checkpoint.js`

### Purpose

Implements the human approval checkpoint before emails are sent.

### Why It Exists Architecturally

Cold email delivery is irreversible and has ethical, reputational, and deliverability risks. The checkpoint lets the system remain automated through data sourcing and enrichment while requiring explicit human consent before outreach.

### Function: `runSafetyCheckpoint(enrichedLeads)`

Input:

- `enrichedLeads: EnrichedLead[]`

Output:

- `Promise<boolean>`
- `true`: user approved delivery.
- `false`: no leads, user rejected, or input handling failed.

Important code blocks:

- Line 11 logs the checkpoint as Stage 4.
- Lines 13-16 halt if no verified leads exist.
- Lines 18-27 print a readable summary table.
- Lines 20-25 transform leads into table rows with domain, name, title, and email.
- Line 26 uses `console.table` for scannability.
- Line 29 prints a warning about initiating automated email blasts.
- Line 31 creates a `readline` interface using process stdin/stdout.
- Lines 33-44 ask for confirmation inside `try`.
- Line 34 asks `Do you authorize... (y/N)`.
- Line 35 closes the readline interface after receiving input.
- Line 37 normalizes input.
- Lines 38-40 return `true` for `y` or `yes`.
- Lines 41-44 return `false` for everything else.
- Lines 45-49 close readline, log the input error, and return `false`.

### Data Flow

Input:

- Finalized lead list from `src/index.js`.

Output:

- Boolean authorization decision to `src/index.js`.

Next stage usage:

- Brevo runs only when this returns `true`.

### Error Handling

The checkpoint is fail-closed. If input handling fails, it returns `false` rather than sending emails.

### Safety Mechanisms

- Blocks delivery when lead list is empty.
- Shows a table before sending.
- Requires explicit affirmative input.
- Defaults to rejection for blank input, `n`, or any unrecognized string.

### Weaknesses

- Interactive prompts do not work well in CI, cron, queues, or serverless jobs.
- No audit log of who approved.
- No approval timeout.
- Logs full email addresses to console.
- Stage numbering conflicts with Brevo stage.

## 9. File Walkthrough: `src/stages/stage4_brevo.js`

### Purpose

Sends personalized outreach emails via Brevo.

### Why It Exists Architecturally

This is the delivery stage: it converts approved, verified lead data into actual outbound email messages.

### Local Function: `sleep(ms)`

Input:

- `ms: number`

Output:

- `Promise<void>`

Purpose:

- Adds 1-second spacing between email sends.

Weakness:

- Duplicates the shared `sleep`.

### Function: `sendOutreachEmails(approvedLeads)`

Input:

- `approvedLeads: EnrichedLead[]`

Output:

- `Promise<void>`
- Side effect: sends emails through Brevo or logs mock/test sends.

External API:

- `POST https://api.brevo.com/v3/smtp/email`
- Auth header: `api-key: config.brevoApiKey`
- JSON body includes sender, recipient, subject, and `htmlContent`.

Important code blocks:

- Line 13 logs Stage 4 delivery.
- Lines 15-20 return early if no approved leads exist.
- Line 22 creates `seenEmails` to prevent duplicate sends during this run.
- Lines 24-28 filter leads to only those with an email and `emailStatus === 'VERIFIED'`.
- Lines 30-32 log how many verified contacts will be sent.
- Line 34 initializes success count.
- Line 36 loops sequentially over sendable leads.
- Lines 38-43 skip duplicate email addresses.
- Line 45 records the email as seen.
- Lines 47-48 derive first name from `lead.name`.
- Lines 50-51 derive company name from the domain prefix.
- Lines 53-54 build a personalized subject.
- Lines 56-84 build personalized HTML email content.
- Lines 89-128 implement test mode if `config.testRecipient` exists.
- Lines 94-117 send test email to the test recipient instead of the real lead.
- Lines 119-127 count the test send, sleep, and continue to next lead.
- Lines 133-141 implement mock mode if `BREVO_API_KEY` equals `mock_brevo`.
- Lines 146-148 log real delivery.
- Lines 150-173 send the real Brevo email.
- Lines 175-181 log success, increment count, and sleep 1 second.
- Lines 183-197 catch and log delivery failure for one lead.
- Lines 200-204 print final delivery results.

### Data Flow

Input:

- Approved leads from checkpoint.

Output:

- No data returned.
- Side effects in Brevo: transactional emails are sent.

### Error Handling

The function catches errors per lead. A failed email send does not stop later sends.

### Reliability and Safety Mechanisms

- Requires checkpoint approval upstream.
- Filters to verified emails only.
- Deduplicates recipient emails using `seenEmails`.
- Sends sequentially.
- Sleeps 1 second between successful real/test sends.
- Supports mock mode via `BREVO_API_KEY === 'mock_brevo'`.
- Attempts to support test mode via `config.testRecipient`.

### Weaknesses

- `config.testRecipient` is not defined in `environment.js`, so test mode is unreachable.
- No unsubscribe link or compliance footer.
- No plain-text alternative.
- No HTML escaping; names and titles from external APIs are interpolated directly.
- No retry/backoff for Brevo failures.
- No handling for Brevo rate-limit status codes.
- No suppression list.
- No send log or idempotency key.
- `companyName` derived by splitting domain at `.`, so `foo-bar.com` remains crude and `app.stripe.com` becomes `app`.

## 10. File Walkthrough: `src/utils/resilience.js`

### Purpose

Provides reusable helpers for deduplication, throttling, and post-enrichment data hygiene.

### Function: `deduplicateArray(array)`

Input:

- `array: string[]`

Output:

- `string[]` of unique, lowercased, trimmed strings.
- Returns `[]` if input is not an array.

Important code blocks:

- Line 9 guards against non-array input.
- Line 10 maps every item to `item.trim().toLowerCase()` and deduplicates with `Set`.
- Line 11 calculates how many items were removed.
- Lines 12-14 log removed duplicate count if any.
- Line 15 returns unique items.

Reliability:

- Normalizes domain casing and whitespace.

Weakness:

- If the array contains non-string items, `item.trim()` throws.

### Function: `sleep(ms)`

Input:

- `ms: number`

Output:

- `Promise<void>`

Purpose:

- Provides throttling between API calls.

Important code:

- Line 24 returns a promise that resolves after `setTimeout`.

Weakness:

- Not used by Stage 2, Stage 3, or Brevo, which each define their own local sleep.

### Function: `sanitizeAndFilterLeads(leads)`

Input:

- `leads: EnrichedLead[]`

Output:

- `EnrichedLead[]` after email deduplication and risky-status removal.

Important code blocks:

- Line 33 logs hygiene checks.
- Line 34 creates `uniqueEmails`.
- Line 35 initializes `pristineLeads`.
- Line 37 loops through leads.
- Line 38 skips leads with no email.
- Line 40 normalizes email as lowercase/trimmed key.
- Lines 43-46 skip duplicate email addresses.
- Lines 49-52 skip `risky` or `catch_all` statuses.
- Line 54 records the email as accepted.
- Line 55 pushes the lead.
- Line 58 returns sanitized leads.

Reliability:

- Prevents duplicate outreach to same mailbox.
- Attempts to prevent risky deliverability sends.

Weaknesses:

- Prospeo enrichment uses uppercase `VERIFIED`, but the risky checks are lowercase only.
- Does not validate email syntax.
- Does not guard against non-array input.
- Does not log final kept/dropped counts.

## 11. File Walkthrough: `src/utils/logger.js`

### Purpose

Standardizes CLI logs with colors and severity labels.

### Why It Exists Architecturally

A CLI pipeline needs transparent execution feedback. Centralized logging prevents every file from reinventing formatting.

### Important Code Blocks

- Lines 1-10 define ANSI color escape codes.
- Lines 12-39 export `logger`.
- Lines 13-15 define `stage(stageNumber, title)`, which prints a prominent stage header.
- Lines 17-19 define `info(message)`.
- Lines 21-23 define `success(message)`.
- Lines 25-27 define `warn(message)`.
- Lines 29-34 define `error(message, errorObject = null)`.
- Lines 31-33 print an optional `errorObject.message`.
- Lines 36-38 define `divider()`.

### Inputs and Outputs

Input:

- String messages and optional error objects.

Output:

- Console output only.

### Error Handling

`logger.error` checks `errorObject && errorObject.message` before reading `message`.

### Weaknesses

- Uses Unicode symbols, which may not render everywhere.
- No structured JSON logs.
- No log levels.
- No timestamps.
- No redaction of secrets if accidentally passed in.

## 12. File Walkthrough: `test-prospeo.js`

### Purpose

Standalone script for manually testing the Prospeo search API.

### Why It Exists Architecturally

It is not part of the production pipeline. It exists as an integration smoke test or exploratory script.

### Important Code Blocks

- Line 2 imports `axios`.
- Line 3 imports `dotenv`.
- Line 5 loads `.env`.
- Lines 7-26 call Prospeo search for `razorpay.com`.
- Lines 21-24 attach the Prospeo API key and content type.
- Line 28 prints the full response.
- Lines 29-32 catch errors and print status and response body.

### Inputs and Outputs

Input:

- `PROSPEO_API_KEY` from `.env`.

Output:

- Raw Prospeo response or error printed to console.

### External API

- `POST https://api.prospeo.io/search-person`

### Weaknesses

- Hardcoded domain.
- No timeout.
- Prints raw API response.
- Not wired into `package.json` as a test script.
- Ignored by Git, so it may not be available to reviewers.

## 13. File Walkthrough: `package.json`

### Purpose

Defines the Node.js package metadata and dependencies.

### Important Lines

- Line 2 names the package `subspace-automated-outreach`.
- Line 4 sets `"type": "module"`, enabling ES module `import/export`.
- Line 5 sets `src/index.js` as the main entry.
- Lines 6-9 declare dependencies:
  - `axios` for HTTP calls.
  - `dotenv` for environment loading.

### Weaknesses

- No `scripts` section. A useful script would be `"start": "node src/index.js"`.
- Dependency versions differ from `package-lock.json`.
- No test, lint, or format scripts.
- No engines field declaring Node version.

## 14. File Walkthrough: `package-lock.json`

### Purpose

Locks exact dependency versions for reproducible installs.

### Important Details

- The lockfile project name is `subspace`, while `package.json` says `subspace-automated-outreach`.
- The lockfile dependencies show `axios ^1.17.0` and `dotenv ^17.4.2`.
- `package.json` declares `axios ^1.7.2` and `dotenv ^16.4.5`.

### Interview Defense

This is a project hygiene issue. It suggests `package.json` was edited after install or generated from a different state. In production, run `npm install` after updating `package.json` so lockfile and manifest agree.

## 15. File Walkthrough: `.env`

### Purpose

Stores local runtime secrets and configuration.

### Keys Present

- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `PROSPEO_API_KEY`
- `OCEAN_API_KEY`
- `EAZYREACH_API_KEY`
- `NODE_ENV`
- `SEED_DOMAIN`
- `TEST_RECIPIENT`
- `BREVO_SMTP_KEY`

### Data Flow

`environment.js` loads this file and exports selected values through `config`.

### Security

Positive:

- `.env` is in `.gitignore`.

Risks:

- The local file contains real secrets.
- `BREVO_SMTP_KEY` is present but unused.
- `TEST_RECIPIENT` is present but not exposed through `config`.

## 16. File Walkthrough: `.gitignore`

### Purpose

Prevents committing local/generated/sensitive files.

### Lines

- `node_modules/`: excludes installed dependencies.
- `.env`: excludes secrets.
- `process.txt`: excludes local planning notes.
- `test-prospeo.js`: excludes one-off test script.

### Weakness

Ignoring `test-prospeo.js` while it exists in the working tree makes repo state confusing. If it is valuable, commit it under a formal `scripts/` or `tests/` path. If not, remove it from the project walkthrough.

## 17. File Walkthrough: `README.md`

### Purpose

Currently empty.

### Why It Should Exist

A README should explain setup, environment variables, how to run the pipeline, vendor accounts needed, safety behavior, and known limitations.

### Weakness

For an interview, an empty README is a visible documentation gap.

## 18. File Walkthrough: `process.txt`

### Purpose

Documents the intended build plan and project phases.

### Architectural Value

It shows planning: account setup, pipeline structure, stage implementation, checkpoint, outreach delivery, reliability hardening, and demo prep.

### Important Observations

- It states Eazyreach will resolve LinkedIn URLs into emails.
- It states Stage 1 should handle pagination, but current Stage 1 does not.
- It states retries will be implemented, but current code mostly uses sleeps and partial-failure handling, not true retries.
- It states duplicate domains, contacts, and emails should be filtered; current code handles domains and emails, but not contacts.

## 19. File Walkthrough: Assignment PDF

### Purpose

Defines the requirements for the take-home project.

### Requirements It Establishes

- Input: one company domain.
- Stage 1: Ocean.io finds lookalike company domains.
- Stage 2: Prospeo finds decision-makers and LinkedIn URLs.
- Stage 3: Eazyreach resolves verified work emails.
- Stage 4: Brevo sends personalized outreach emails.
- Each stage feeds the next automatically.
- A safety checkpoint before emails is considered sensible.
- Evaluation focuses on end-to-end execution, integrations, modularity, messy data resilience, and good judgment.

### Current Compliance

- The project implements the pipeline shape.
- It uses Ocean.io, Prospeo, and Brevo.
- It includes a human safety checkpoint.
- It does not currently use Eazyreach for enrichment.
- It ignores the CLI argument.

## 20. Stage-by-Stage Execution Flow

### Stage 1: Ocean.io

Why it exists:

- To expand one seed domain into similar target companies.

Problem it solves:

- Without this stage, the user must manually source target companies.

API called:

- `POST https://api.ocean.io/v3/search/companies`

Data received:

- Ocean.io response expected to contain `companies`.

Data returned:

- Array of company domain strings.

Failure handling:

- Schema mismatch returns `[]`.
- Request errors log status/message and return `[]`.

Next stage:

- Domains are deduplicated, capped at 3, then passed to Prospeo search.

### Stage 2: Prospeo Search

Why it exists:

- To convert target companies into actual people to contact.

Problem it solves:

- Company domains alone are not actionable for outreach.

API called:

- `POST https://api.prospeo.io/search-person`

Data received:

- Search results containing `person` objects.

Data returned:

- Lead objects with domain, person ID, name, title, LinkedIn, and email status.

Failure handling:

- Per-domain catch prevents one bad domain from killing all searches.
- Rate-limit error causes 60-second pause.

Next stage:

- First 5 leads are passed to enrichment.

### Stage 3: Prospeo Enrichment

Why it exists:

- To resolve verified work emails.

Problem it solves:

- Search results may identify people without verified deliverable emails.

API called:

- Current implementation: `POST https://api.prospeo.io/enrich-person`
- Assignment expectation: Eazyreach LinkedIn-to-email enrichment.

Data received:

- Enriched Prospeo `person` object with `email`.

Data returned:

- Leads with verified email fields attached.

Failure handling:

- Per-lead catch.
- Missing `personId` is skipped.
- Missing or non-verified email is skipped.
- Rate-limit error causes 60-second pause.

Next stage:

- Enriched leads are sanitized and shown at the checkpoint.

### Stage 4: Checkpoint

Why it exists:

- To prevent accidental real email blasts.

Problem it solves:

- Automated outreach can cause reputational and compliance damage if sent blindly.

API called:

- None.

Data received:

- Final verified leads.

Data returned:

- Boolean authorization decision.

Failure handling:

- Empty lead list returns `false`.
- Input errors return `false`.
- Any answer other than `y` or `yes` returns `false`.

Next stage:

- Brevo delivery only runs if authorization is `true`.

### Stage 5: Brevo

Why it exists:

- To send the outreach emails.

Problem it solves:

- Converts verified leads into actual outbound messages.

API called:

- `POST https://api.brevo.com/v3/smtp/email`

Data received:

- Brevo response is not inspected in detail; success is assumed if Axios does not throw.

Data returned:

- No return value; logs success count.

Failure handling:

- Per-lead catch.
- Failed sends do not stop later sends.

Next stage:

- None. This is terminal delivery.

## 21. System Design

### Overall Architecture

This is a sequential CLI pipeline:

`Seed domain -> Ocean.io company sourcing -> Prospeo people search -> Prospeo email enrichment -> human checkpoint -> Brevo email delivery`

### Why Pipeline Architecture Was Chosen

The problem is naturally staged. Each service transforms data into a shape required by the next service:

- Ocean.io transforms one domain into many domains.
- Prospeo search transforms domains into people.
- Enrichment transforms people into verified emails.
- Checkpoint transforms data into a human approval decision.
- Brevo transforms approved leads into email sends.

### Advantages of Modular Stages

- Each API integration is isolated.
- Failures are easier to reason about.
- A stage can be swapped without rewriting the entire app.
- The live interview can ask for a single-stage change.
- Testing can target one vendor contract at a time.

### Separation of Concerns

- `index.js` controls orchestration.
- `environment.js` controls configuration.
- Stage files control vendor APIs.
- Utility files control logging, hygiene, and approval.

## 22. Design Decisions

### Why Ocean.io

Ocean.io is a fit for lookalike company discovery. It solves the sourcing problem at the company level, especially when the only input is a known good customer domain.

### Why Prospeo

Prospeo provides people search by company website and can identify decision-makers. The current code also uses Prospeo enrichment because it already has `person_id`, making enrichment straightforward.

### Why Enrichment Is Separated From Search

Search and enrichment are different jobs:

- Search identifies possible people.
- Enrichment verifies whether they have usable work emails.

Keeping them separate avoids paying enrichment cost for every raw contact before filtering for executives.

### Why Human Approval Checkpoint Exists

It is a safety boundary before irreversible external side effects. It demonstrates judgment around compliance, deliverability, and accidental automation.

### Why Brevo

Brevo provides a transactional email API with sender identity configuration. It is practical for programmatic email sending and easier to wire into a Node CLI than hand-rolling SMTP.

## 23. Reliability

### Rate Limiting Strategy

Current strategy:

- Sequential requests.
- 1.5-second pause after Stage 1 before Stage 2.
- 1.5-second pause between Prospeo search domains.
- 1-second pause between enrichment successes.
- 1-second pause between Brevo sends.
- 60-second wait when Prospeo returns a rate-limit error string.

Limitations:

- No exponential backoff.
- No retry loop.
- No per-provider rate-limit configuration.
- No parsing of HTTP `429` headers.
- No concurrency controls beyond sequential loops.

### Error Recovery Strategy

Current strategy:

- Stage-level or item-level `try/catch`.
- Return empty arrays for failed discovery.
- Skip failed domains/leads/sends.
- Keep the pipeline moving with partial results.

Limitations:

- No persistence.
- No resume after crash.
- No dead-letter queue.
- No retry budget.
- No final structured failure report.

### Deduplication Strategy

Current strategy:

- Stage 1 deduplicates domains.
- Orchestrator deduplicates domains again.
- `sanitizeAndFilterLeads` deduplicates email addresses.
- Brevo deduplicates email sends within a single run.

Limitations:

- No person-level deduplication.
- No cross-run deduplication.
- No database-backed suppression list.

### Data Validation Strategy

Current strategy:

- Required env var validation.
- Ocean response schema check for companies array.
- Stage 2 skips missing person objects.
- Stage 3 skips missing `personId`.
- Stage 3 requires `VERIFIED` email.
- Checkpoint blocks empty lead list.
- Brevo filters to `emailStatus === 'VERIFIED'`.

Limitations:

- No domain format validation.
- No email regex or deliverability library.
- No full response schema validation.
- No validation of Brevo sender email.

## 24. Security

### Environment Variable Management

Secrets are placed in `.env`, loaded through `dotenv`, and consumed through `config`.

### API Key Protection

Positive:

- No hardcoded API keys in source files.
- `.env` is ignored by Git.
- Vendor keys are centralized.

Risks:

- Raw API response bodies are printed on errors.
- Full recipient emails are printed at checkpoint and logs.
- No redaction layer in logger.
- No secret scanning.
- No least-privilege discussion for API keys.
- No rotation strategy.

### Improvements

- Add logger redaction for known secret patterns.
- Add `.env.example`.
- Add secret scanning in CI.
- Avoid printing raw vendor error bodies unless debug mode is enabled.
- Use scoped API keys where vendors support them.
- Add `TEST_RECIPIENT` to config and use test mode for demos.

## 25. Scalability

### What Breaks at 10,000 Companies

- Sequential processing becomes too slow.
- API rate limits will dominate runtime.
- No pagination means incomplete results.
- No database means no durable progress tracking.
- No queue means crashes lose state.
- Console output becomes unusable.
- Human checkpoint with thousands of contacts is impractical.
- Email sending without suppression/compliance controls risks domain reputation.

### How to Scale

- Store companies, people, enrichments, approvals, and sends in a database.
- Use queues for each stage.
- Add worker pools with provider-specific concurrency limits.
- Track job status and retries.
- Add idempotency keys to avoid duplicate sends.
- Add pagination and cursor storage.
- Add batch approval UI instead of CLI prompt.

### Queue-Based Improvements

Use separate queues:

- `company-discovery`
- `person-search`
- `email-enrichment`
- `approval`
- `email-send`

Each job should include:

- input payload
- status
- retry count
- provider
- timestamps
- error details
- idempotency key

### Database Improvements

Suggested tables:

- `seed_runs`
- `companies`
- `contacts`
- `email_enrichments`
- `approvals`
- `email_sends`
- `suppression_list`

### Caching Opportunities

- Cache Ocean lookalikes by seed domain.
- Cache Prospeo search results by company domain.
- Cache enrichment by `personId` or LinkedIn URL.
- Cache negative results to avoid repeatedly paying for missing emails.

## 26. Honest Weaknesses and Technical Debt

- CLI argument is ignored.
- Stage 3 is misnamed and does not call Eazyreach.
- `EAZYREACH_API_KEY` is required but not used.
- `TEST_RECIPIENT` exists but test mode cannot run because config does not export it.
- `package.json` and `package-lock.json` are inconsistent.
- README is empty.
- No npm scripts.
- No tests.
- No pagination.
- No true retries.
- No exponential backoff.
- No database or persistence.
- No structured logging.
- No compliance controls like unsubscribe, suppression list, or audit trail.
- No email HTML escaping.
- No contact-level deduplication.
- Hardcoded caps of 3 domains and 5 leads.
- Magic sleep durations.
- Raw vendor errors are printed.
- Empty Stage 1 output is not treated as a first-class failure.
- Stage numbering is confusing.
- Local `sleep` is duplicated in multiple files.

## 27. Interview Questions and Model Answers

1. Why did you use a pipeline architecture?
Answer: The workflow is a sequence of data transformations. Each vendor produces the input needed by the next vendor, so a pipeline keeps responsibilities clear and makes each stage independently replaceable.

2. What is the role of `src/index.js`?
Answer: It is the orchestrator. It controls order, applies cross-stage limits and hygiene, invokes the checkpoint, and decides whether delivery should happen.

3. Why not put all API calls in `index.js`?
Answer: That would couple orchestration to vendor details. Separate stage files make the system easier to read, test, replace, and defend.

4. What happens if Ocean.io fails?
Answer: Stage 1 catches the error, logs it, and returns an empty array. Downstream stages receive no domains and the pipeline eventually halts at the checkpoint because there are no verified contacts.

5. What does Stage 1 return?
Answer: A string array of company domains extracted from `response.data.companies[*].company.domain`.

6. Why cap Ocean results to 3?
Answer: It controls cost, runtime, and demo blast radius. In production, this should be configurable.

7. How does Stage 2 identify executives?
Answer: It lowercases each job title and checks whether it contains keywords like CEO, CTO, founder, VP, director, or head.

8. What is weak about keyword title matching?
Answer: It can miss relevant titles and include false positives. A better approach would combine API-side filters, seniority fields, and configurable title rules.

9. Why is `personId` important?
Answer: Stage 3 uses Prospeo `person_id` to enrich the person and retrieve a verified email.

10. Does Stage 3 use Eazyreach?
Answer: No. The file name says Eazyreach, but the implementation calls Prospeo enrichment. I would call that out honestly and either rename the file or implement true Eazyreach integration.

11. Why separate search from enrichment?
Answer: Search produces many candidates. Enrichment costs API credits and should happen only after filtering to relevant people.

12. What does `only_verified_email: true` do?
Answer: It asks Prospeo to return only verified emails, reducing risk of sending to invalid or risky addresses.

13. How are duplicate domains handled?
Answer: Ocean stage deduplicates with `Set`, and the orchestrator also calls `deduplicateArray`.

14. How are duplicate emails handled?
Answer: `sanitizeAndFilterLeads` deduplicates before checkpoint, and Brevo delivery also keeps a `seenEmails` set during sending.

15. Why have duplicate protection twice?
Answer: Defense in depth. Hygiene protects the data set; send-level dedupe protects the irreversible side effect.

16. What happens if the user presses Enter at the checkpoint?
Answer: The answer normalizes to an empty string, which is not `y` or `yes`, so the pipeline aborts safely.

17. Why is the checkpoint valuable?
Answer: It prevents accidental email blasts and lets a human inspect recipients before irreversible delivery.

18. What API does Brevo use?
Answer: The transactional SMTP email endpoint: `POST https://api.brevo.com/v3/smtp/email`.

19. How does the Brevo stage personalize emails?
Answer: It derives first name from `lead.name`, company name from `lead.domain`, includes the lead title, and builds a personalized subject and HTML body.

20. What is the biggest security risk?
Answer: Raw API error data and full emails are logged. There is no redaction layer, so sensitive data could leak into terminal logs or screenshots.

21. What would fail at 10,000 companies?
Answer: Sequential processing, lack of pagination, no persistence, no queueing, and no scalable approval interface.

22. How would you add retries?
Answer: Create a shared request wrapper with retry count, exponential backoff, jitter, provider-specific retryable status codes, and structured error reporting.

23. Why is `package-lock.json` a concern?
Answer: It disagrees with `package.json`, suggesting dependency state is stale or inconsistent. Reproducible builds require those files to agree.

24. Why use environment variables?
Answer: They keep secrets out of source code and allow different credentials/configuration per environment.

25. What config key is missing from export?
Answer: `TEST_RECIPIENT` exists in `.env`, but `environment.js` does not export `testRecipient`, so Brevo test mode is unreachable.

26. Is the command `node src/index.js stripe.com` correctly supported?
Answer: Not fully. The code ignores `process.argv[2]`; it uses `SEED_DOMAIN` or defaults to `stripe.com`.

27. How would you make it production-ready?
Answer: Add CLI parsing, tests, schema validation, retries, pagination, queues, database persistence, suppression lists, audit logs, and compliance-safe email templates.

28. Why does each stage catch errors internally?
Answer: To tolerate partial failures. A single bad domain, lead, or email send should not necessarily crash the whole batch.

29. What is the tradeoff of partial failure tolerance?
Answer: The pipeline keeps running, but failures can be hidden unless there is a final structured report.

30. What live coding tweak might be easy because of this architecture?
Answer: Replacing Stage 3 with a true Eazyreach integration, adding CLI argument parsing, or adding pagination to Stage 2 can be done without rewriting the whole pipeline.

