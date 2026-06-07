import axios from 'axios';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

export async function getDecisionMakers(domains) {
  logger.info(
    `Initializing Prospeo lead mining across ${domains.length} target domains...`
  );

  const allLeads = [];

  const executiveKeywords = [
    'ceo',
    'cto',
    'cfo',
    'coo',
    'chief',
    'founder',
    'owner',
    'president',
    'vp',
    'vice president',
    'director',
    'head'
  ];

  for (const domain of domains) {
    try {
      logger.info(`Searching contacts for: ${domain}`);

      const response = await axios.post(
        'https://api.prospeo.io/search-person',
        {
          page: 1,
          filters: {
            company: {
              websites: {
                include: [domain]
              }
            }
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

      const results = response.data?.results || [];

      let qualifiedLeads = 0;

      for (const item of results) {
        const person = item?.person;

        if (!person) continue;

        const title = (
          person.current_job_title || ''
        ).toLowerCase();

        const isExecutive = executiveKeywords.some(
          keyword => title.includes(keyword)
        );

        if (!isExecutive) continue;

        allLeads.push({
          domain,

          personId: person.person_id,

          name:
            person.full_name ||
            `${person.first_name || ''} ${person.last_name || ''}`.trim(),

          title:
            person.current_job_title ||
            'Unknown',

          linkedin:
            person.linkedin_url || null,

          emailStatus:
            person.email?.status || 'UNKNOWN'
        });

        qualifiedLeads++;
      }

      logger.success(
        `Found ${qualifiedLeads} executive contacts from ${domain}`
      );

      await sleep(1500);
    } catch (error) {
      logger.error(
        `Skipping domain [${domain}] due to request error.`
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
    `Stage 2 Complete. Total qualified leads mined: ${allLeads.length}`
  );

  return allLeads;
}