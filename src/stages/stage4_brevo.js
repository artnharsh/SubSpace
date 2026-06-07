import axios from 'axios';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Stage 4: Send personalized outreach emails via Brevo
 * Only verified emails are allowed through.
 */
export async function sendOutreachEmails(approvedLeads) {
  logger.stage(4, 'Brevo Transactional Email Delivery');

  if (!approvedLeads || approvedLeads.length === 0) {
    logger.warn(
      'No approved leads available for email delivery.'
    );
    return;
  }

  const seenEmails = new Set();

  const sendableLeads = approvedLeads.filter(
    lead =>
      lead.email &&
      lead.emailStatus === 'VERIFIED'
  );

  logger.info(
    `Preparing delivery sequence for ${sendableLeads.length} verified contacts...`
  );

  let successCount = 0;

  if (config.demoMode) {
  logger.warn(
    'DEMO MODE ENABLED - Simulating email delivery'
  );

  approvedLeads.forEach(lead => {
    logger.success(
      `[DEMO SEND] Email delivered to ${lead.name} (${lead.email})`
    );
  });

  logger.success(
    `Delivery sequence completed. Successfully sent ${approvedLeads.length}/${approvedLeads.length} emails.`
  );

  return;
}

  for (const lead of sendableLeads) {
    try {
      if (seenEmails.has(lead.email)) {
        logger.warn(
          `Duplicate email skipped: ${lead.email}`
        );
        continue;
      }

      seenEmails.add(lead.email);

      const firstName =
        lead.name?.split(' ')[0] || 'there';

      const companyName =
        lead.domain?.split('.')[0] || 'your company';

      const emailSubject =
        `Quick question about ${companyName}`;

      const htmlContent = `
        <p>Hi ${firstName},</p>

        <p>
          I came across your work as
          <strong>${lead.title}</strong>
          at <strong>${companyName}</strong>.
        </p>

        <p>
          I've been building workflow automation systems
          that help teams eliminate repetitive manual
          processes and improve operational efficiency.
        </p>

        <p>
          Would you be open to a brief conversation
          sometime this week?
        </p>

        <p>
          Looking forward to hearing from you.
        </p>

        <p>
          Best regards,<br/>
          ${config.brevoSenderName}
        </p>
      `;

      /**
       * TEST MODE
       */
      if (config.testRecipient) {
        logger.info(
          `[TEST MODE] Redirecting email for ${lead.name} -> ${config.testRecipient}`
        );

        await axios.post(
          'https://api.brevo.com/v3/smtp/email',
          {
            sender: {
              name: config.brevoSenderName,
              email: config.brevoSenderEmail
            },
            to: [
              {
                email: config.testRecipient,
                name: 'Pipeline Test'
              }
            ],
            subject: `[TEST] ${emailSubject}`,
            htmlContent
          },
          {
            headers: {
              'api-key': config.brevoApiKey,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        logger.success(
          `Test email delivered successfully.`
        );

        successCount++;

        await sleep(1000);

        continue;
      }

      /**
       * MOCK MODE
       */
      if (config.brevoApiKey === 'mock_brevo') {
        logger.success(
          `[MOCK SEND] ${lead.name} (${lead.email})`
        );

        successCount++;

        continue;
      }

      /**
       * REAL DELIVERY
       */
      logger.info(
        `Sending outreach email to ${lead.email}`
      );

      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: {
            name: config.brevoSenderName,
            email: config.brevoSenderEmail
          },
          to: [
            {
              email: lead.email,
              name: lead.name
            }
          ],
          subject: emailSubject,
          htmlContent
        },
        {
          headers: {
            'api-key': config.brevoApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      logger.success(
        `Email delivered successfully to ${lead.name}`
      );

      successCount++;

      await sleep(1000);

    } catch (error) {
      logger.error(
        `Failed delivery for ${lead.email}`
      );

      if (error.response?.data) {
        console.log(
          JSON.stringify(
            error.response.data,
            null,
            2
          )
        );
      }
    }
  }

  logger.divider();

  logger.success(
    `Delivery sequence completed. Successfully sent ${successCount}/${sendableLeads.length} emails.`
  );
}