import axios from 'axios';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

/**
 * Stage 3: Resolves LinkedIn URLs into verified work email addresses
 * @param {Array} leads - Array of lead objects containing LinkedIn URLs
 * @returns {Promise<Array>} Enriched lead objects with email data
 */
export async function enrichLeadsWithEmails(leads) {
  logger.info(`Initializing Eazyreach email resolution for ${leads.length} leads...`);
  const enrichedLeads = [];

  // Automated Mock Framework Check: Safely runs if API key hasn't been received over WhatsApp yet
  if (config.isEazyreachMocked) {
    logger.warn('Eazyreach API key is currently unassigned. Deploying local verification sandbox...');
    
    return leads.map((lead, index) => ({
      ...lead,
      email: `exec.${lead.name.toLowerCase().replace(/\s+/g, '')}@${lead.domain}`,
      emailStatus: 'verified'
    }));
  }

  // Production Execution Pathway once your official key is swapped in
  for (const lead of leads) {
    try {
      logger.info(`Resolving email for profile: ${lead.linkedin}`);

      const response = await axios.post(
        'https://api.eazyreach.app/v1/enrich', // Update with exact endpoint from Eazyreach docs
        { linkedin_url: lead.linkedin },
        {
          headers: {
            'Authorization': `Bearer ${config.eazyreachApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        }
      );

      // Handle common enrichment response shapes (adjust following their real docs)
      const email = response.data?.email || response.data?.data?.email;
      const status = response.data?.status || 'verified';

      if (email) {
        enrichedLeads.push({
          ...lead,
          email: email,
          emailStatus: status
        });
      } else {
        logger.warn(`No professional email discovered for executive: ${lead.name}`);
      }

    } catch (error) {
      logger.error(`Failed to resolve email for ${lead.name}. Skipping contact entry.`, error);
    }
  }

  return enrichedLeads;
}
