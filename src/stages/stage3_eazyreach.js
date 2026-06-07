import { logger } from '../utils/logger.js';

/**
 * Stage 3: Email Enrichment
 *
 * Current Mode:
 * - No EazyReach API available
 * - Uses local enrichment adapter
 *
 * Future Mode:
 * - Replace enrichLead() with EazyReach API
 * - Or Prospeo Enrich Person API
 */

export async function enrichEmails(leads) {
  logger.info(
    `Initializing Eazyreach email resolution for ${leads.length} leads...`
  );

  if (!leads || leads.length === 0) {
    logger.warn(
      'No leads received from Stage 2. Skipping enrichment.'
    );

    return [];
  }

  const enrichedLeads = [];

  for (const lead of leads) {
    try {
      const enrichedLead = await enrichLead(lead);

      if (enrichedLead) {
        enrichedLeads.push(enrichedLead);
      }
    } catch (error) {
      logger.error(
        `Failed email enrichment for ${lead.name}: ${error.message}`
      );
    }
  }

  logger.success(
    `Successfully enriched ${enrichedLeads.length} contacts`
  );

  return enrichedLeads;
}

/**
 * Local enrichment adapter.
 * Replace this entire function later with:
 * - EazyReach API
 * - Prospeo Enrich Person API
 */
async function enrichLead(lead) {
  const sanitizedName = lead.name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('');

  return {
    ...lead,

    email: `exec.${sanitizedName}@${lead.domain}`,

    emailStatus:
      lead.emailStatus || 'SIMULATED',

    enrichmentProvider:
      'LOCAL_SANDBOX',

    enrichedAt:
      new Date().toISOString()
  };
}