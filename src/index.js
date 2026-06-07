import { config } from './config/environment.js';
import { logger } from './utils/logger.js';
import inquirer from 'inquirer';

import { getLookalikeCompanies } from './stages/stage1_ocean.js';
import { getDecisionMakers } from './stages/stage2_prospeo.js';
import { enrichEmails } from './stages/stage3_eazyreach.js';
import { sendOutreachEmails } from './stages/stage4_brevo.js';

import { runSafetyCheckpoint } from './utils/checkpoint.js';

import {
  deduplicateArray,
  sanitizeAndFilterLeads,
  sleep
} from './utils/resilience.js';

async function runMasterPipeline() {
  try {
    logger.stage(
  0,
  'Initializing Production Automated Outreach Pipeline'
);

if (config.demoMode) {
  logger.warn(
    '======================================'
  );

  logger.warn(
    'RUNNING IN DEMO MODE'
  );

  logger.warn(
    'External APIs are bypassed'
  );

  logger.warn(
    '======================================'
  );
}

let seedDomain = process.argv[2];

if (!seedDomain) {
  const answer = await inquirer.prompt([
    {
      type: 'input',
      name: 'domain',
      message: 'Enter a company domain:',
      validate: input =>
        input.trim().length > 0 ||
        'Domain is required'
    }
  ]);

  seedDomain = answer.domain.trim();
}

logger.info(
  `Target Seed Domain Input: "${seedDomain}"`
);

    logger.divider();

    /**
     * STAGE 1
     * Ocean.io
     */
    const rawDomains =
  await getLookalikeCompanies(seedDomain);

    const targetDomains =
      deduplicateArray(rawDomains).slice(0, 3);

    logger.divider();

    logger.info(
      'Throttling execution thread for 1.5 seconds to preserve API request tokens...'
    );

    await sleep(1500);

    /**
     * STAGE 2
     * Prospeo Search
     */
    const leads = await getDecisionMakers(targetDomains);

const identifiedLeads = leads.slice(0, 5);

    logger.divider();

    /**
     * STAGE 3
     * Email Enrichment
     */
    logger.stage(
      3,
      'Contact Email Enrichment'
    );

    const enrichedLeads =
      await enrichEmails(identifiedLeads);

    const finalizedLeads =
      sanitizeAndFilterLeads(enrichedLeads);

    logger.divider();

    /**
     * Human Approval Checkpoint
     */
    const isAuthorized =
      await runSafetyCheckpoint(finalizedLeads);

    logger.divider();

    /**
     * STAGE 4
     * Brevo Email Delivery
     */
    if (isAuthorized) {
      logger.stage(
        4,
        'Brevo Outreach Delivery'
      );

      await sendOutreachEmails(finalizedLeads);

      logger.success(
        'Master production pipeline completed successfully.'
      );
    } else {
      logger.warn(
        'Pipeline safely halted at validation checkpoint. Delivery engines aborted.'
      );
    }
  } catch (err) {
    logger.error(
      'CRITICAL: Production pipeline suffered an unhandled runtime failure.',
      err
    );
  }
}

runMasterPipeline();