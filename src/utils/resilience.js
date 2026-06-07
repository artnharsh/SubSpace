import { logger } from './logger.js';

/**
 * Strips out duplicate elements from primitive arrays (e.g., domain strings)
 * @param {string[]} array - The raw array of strings to deduplicate
 * @returns {string[]} A clean, unique array of strings
 */
export function deduplicateArray(array) {
  if (!Array.isArray(array)) return [];
  const uniqueItems = [...new Set(array.map(item => item.trim().toLowerCase()))];
  const diff = array.length - uniqueItems.length;
  if (diff > 0) {
    logger.info(`Deduplication Engine: Removed ${diff} duplicate records from data stream.`);
  }
  return uniqueItems;
}

/**
 * Blocks the execution thread for a set period to protect against API rate limits
 * @param {number} ms - The millisecond sleep duration
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Evaluates lead emails to separate highly deliverable profiles from high-risk targets
 * @param {Array} leads - The collection of enriched lead objects
 * @returns {Array} Cleaned and validated lead array
 */
export function sanitizeAndFilterLeads(leads) {
  logger.info('Running production data hygiene checks...');
  const uniqueEmails = new Set();
  const pristineLeads = [];

  for (const lead of leads) {
    if (!lead.email) continue;
    
    const emailKey = lead.email.trim().toLowerCase();

    // 1. Drop duplicate emails across different domains/contacts
    if (uniqueEmails.has(emailKey)) {
      logger.warn(`Deduplication Engine: Dropped duplicate lead profile targeting ${lead.email}`);
      continue;
    }

    // 2. Handle Catch-All / Risky deliverability classification (Core Interview Defense Point)
    if (lead.emailStatus === 'risky' || lead.emailStatus === 'catch_all') {
      logger.warn(`Deliverability Guard: Dropped high-risk email status [${lead.emailStatus}] for ${lead.email}`);
      continue;
    }

    uniqueEmails.add(emailKey);
    pristineLeads.push(lead);
  }

  return pristineLeads;
}
