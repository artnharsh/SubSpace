import { config } from './config/environment.js';
import { logger } from './utils/logger.js';
import { getLookalikeCompanies } from './stages/stage1_ocean.js';
import { getDecisionMakers } from './stages/stage2_prospeo.js';
import { enrichLeadsWithEmails } from './stages/stage3_eazyreach.js';
import { runSafetyCheckpoint } from './utils/checkpoint.js';
import { sendOutreachEmails } from './stages/stage4_brevo.js';
import { deduplicateArray, sanitizeAndFilterLeads, sleep } from './utils/resilience.js';

async function runMasterPipeline() {
  logger.stage(0, 'Initializing Production Automated Outreach Pipeline');
  logger.info(`Target Seed Domain Input: "${config.seedDomain}"`);
  logger.divider();

  // STAGE 1: Sourcing Lookalike Companies
  const rawDomains = await getLookalikeCompanies(config.seedDomain);
  // Apply immediate deduplication to incoming web domains
  const targetDomains = deduplicateArray(rawDomains);
  logger.divider();

  // RATE LIMIT GUARD: Artificial sleep padding between major third-party API hops
  logger.info('Throttling execution thread for 1.5 seconds to preserve API request tokens...');
  await sleep(1500);

  // STAGE 2: Harvesting C-Suite & VP Decision Makers
  const identifiedLeads = await getDecisionMakers(targetDomains);
  logger.divider();

  // STAGE 3: Enriching Contacts with Verified Emails
  logger.stage(3, 'Eazyreach Email Enrichment');
  const rawFinalizedLeads = await enrichLeadsWithEmails(identifiedLeads);
  
  // Apply strict data hygiene and deliverability classification filters
  const finalizedLeads = sanitizeAndFilterLeads(rawFinalizedLeads);
  logger.divider();

  // INTERCEPT CHECKPOINT: Human Validation Guard
  const isAuthorized = await runSafetyCheckpoint(finalizedLeads);
  logger.divider();

  // STAGE 4: Automated Personalized Outreach Delivery
  if (isAuthorized) {
    await sendOutreachEmails(finalizedLeads);
    logger.success('Master production pipeline complete with zero human interaction steps.');
  } else {
    logger.warn('Pipeline safely halted at validation checkpoint. Delivery engines aborted.');
  }
}

runMasterPipeline().catch(err => {
  logger.error('CRITICAL: Production pipeline suffered an unhandled runtime failure.', err);
});
