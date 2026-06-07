import axios from 'axios';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

export async function enrichEmails(leads) {

  if (config.demoMode) {
  logger.warn(
    'DEMO MODE ENABLED - Returning mock enriched contacts'
  );

  return leads.map((lead, index) => ({
    ...lead,

    email: [
      'akhil.joshi@razorpay.com',
      'neeraj.bagdia@cashfree.com',
      'tim.mcdonnell@adyen.com'
    ][index],

    emailStatus: 'VERIFIED',

    enrichmentProvider:
      'DEMO_PROVIDER'
  }));
}

  logger.info(
    `Initializing Prospeo Enrichment for ${leads.length} leads...`
  );

  const enrichedLeads = [];

  for (const lead of leads) {
    try {
      if (!lead.personId) {
        logger.warn(
          `Missing personId for ${lead.name}. Skipping.`
        );
        continue;
      }

      logger.info(
        `Enriching ${lead.name}...`
      );

      const response = await axios.post(
        'https://api.prospeo.io/enrich-person',
        {
          only_verified_email: true,
          data: {
            person_id: lead.personId
          }
        },
        {
          headers: {
            'X-KEY': config.prospeoApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const person = response.data?.person;

      if (!person) {
        continue;
      }

      const emailData = person.email;

      if (
        !emailData ||
        emailData.status !== 'VERIFIED'
      ) {
        logger.warn(
          `No verified email found for ${lead.name}`
        );
        continue;
      }

      enrichedLeads.push({
        ...lead,

        email: emailData.email,

        emailStatus: emailData.status,

        verificationMethod:
          emailData.verification_method,

        enrichmentProvider:
          'PROSPEO_ENRICH'
      });

      logger.success(
        `Verified email found for ${lead.name}`
      );

      await sleep(1000);
    } catch (error) {
      logger.error(
        `Failed enrichment for ${lead.name}`
      );

      if (error.response?.data) {
        console.log(
          JSON.stringify(
            error.response.data,
            null,
            2
          )
        );

        if (
          error.response.data.error_code ===
          'Rate limit exceeded'
        ) {
          logger.warn(
            'Rate limit reached. Waiting 60 seconds before continuing...'
          );

          await sleep(60000);
        }
      }
    }
  }

  logger.success(
    `Stage 3 Complete. Verified ${enrichedLeads.length} contacts.`
  );

  return enrichedLeads;
}