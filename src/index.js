import { config } from './config/environment.js';
import { logger } from './utils/logger.js';
import { getLookalikeCompanies } from './stages/stage1_ocean.js';
import { getDecisionMakers } from './stages/stage2_prospeo.js';
import { enrichLeadsWithEmails } from './stages/stage3_eazyreach.js';
import { runSafetyCheckpoint } from './utils/checkpoint.js';

async function runPipeline() {
  logger.stage(0, 'Initializing Integrated Pipeline Verification Run');
  logger.info(`Seed Target Domain Source: ${config.seedDomain}`);
  
  // 1. Stage 1: Lookalikes
  const targetDomains = await getLookalikeCompanies(config.seedDomain);
  logger.divider();

  // 2. Stage 2: Decision-Makers
  const identifiedLeads = await getDecisionMakers(targetDomains);
  logger.divider();

  // 3. Stage 3: Email Enrichment[cite: 1]
  logger.stage(3, 'Eazyreach Email Enrichment');
  const finalizedLeads = await enrichLeadsWithEmails(identifiedLeads);
  logger.divider();

  // 4. Human Validation Checkpoint Intercept[cite: 1]
  const isAuthorized = await runSafetyCheckpoint(finalizedLeads);
  
  if (isAuthorized) {
    logger.success('Pipeline finalized successfully. Standing by for Stage 4 integration.');
  } else {
    logger.warn('Execution frozen. Clean shutdown complete.');
  }
}

runPipeline().catch(err => logger.error('Pipeline execution runtime crash.', err));
