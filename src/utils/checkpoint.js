import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { logger } from './logger.js';

/**
 * Halts CLI processing and requests keyboard confirmation before launching emails
 * @param {Array} enrichedLeads - Complete data array containing verified emails
 * @returns {Promise<boolean>} True if confirmed, False if rejected
 */
export async function runSafetyCheckpoint(enrichedLeads) {
  logger.stage(4, 'Safety Checkpoint & Guard Intercept');

  if (!enrichedLeads || enrichedLeads.length === 0) {
    logger.error('No verified contact leads available for review. Halting pipeline execution.');
    return false;
  }

  console.log('\n=================== PROSPECT OUTREACH PIPELINE SUMMARY ===================');
  // Format data clearly using native console.table for maximum scannability
  const tableData = enrichedLeads.map(lead => ({
    'Company Domain': lead.domain,
    'Contact Name': lead.name,
    'Job Title': lead.title,
    'Resolved Email Address': lead.email
  }));
  console.table(tableData);
  console.log('==========================================================================\n');

  logger.warn(`CRITICAL INTERCEPT: You are about to initiate automated email blasts to ${enrichedLeads.length} contacts.`);
  
  const rl = readline.createInterface({ input, output });

  try {
    const answer = await rl.question('\x1b[33m👉 Do you authorize the pipeline to fire emails now? (y/N): \x1b[0m');
    rl.close();

    const choice = answer.trim().toLowerCase();
    if (choice === 'y' || choice === 'yes') {
      logger.success('Action Authorized. Dispatched data streams down to delivery sequence.');
      return true;
    } else {
      logger.error('Pipeline Execution Aborted by User.');
      return false;
    }
  } catch (error) {
    rl.close();
    logger.error('Error handling keyboard input during safety intercept.', error);
    return false;
  }
}
