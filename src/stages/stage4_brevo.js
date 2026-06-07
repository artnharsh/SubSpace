import axios from 'axios';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

/**
 * Stage 4: Sends highly personalized transactional emails via Brevo
 * @param {Array} approvedLeads - Array of contacts validated by the user at the checkpoint
 */
export async function sendOutreachEmails(approvedLeads) {
  logger.stage(5, 'Brevo Transactional Email Delivery');
  logger.info(`Initiating delivery sequence for ${approvedLeads.length} authorized contacts...`);

  let successCount = 0;

  for (const lead of approvedLeads) {
    // Isolate first name safely for personalization tokens
    const firstName = lead.name.split(' ')[0] || 'there';
    const companyName = lead.domain.split('.')[0].toUpperCase();

    // Concise, professional cold outreach template design
    const emailSubject = `Partnership Query for ${companyName}`;
    const htmlContent = `
      <p>Hi ${firstName},</p>
      <p>I noticed your work as <strong>${lead.title}</strong> at ${companyName}. I wanted to reach out because we've built an automation workflow tailored directly for high-growth tech firms.</p>
      <p>Would you be open to a brief 5-minute sync later this week to see how we can optimize your team's pipeline velocity?</p>
      <p>Best regards,<br>${config.brevoSenderName}</p>
    `;

    // Handle sandbox tracking seamlessly to protect your real monthly limits
    if (config.brevoApiKey === 'mock_brevo') {
      logger.success(`[MOCK SEND] Email successfully routed to ${lead.name} (${lead.email})`);
      successCount++;
      continue;
    }

    try {
      logger.info(`Dispatching email to: ${lead.email}...`);
      
      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { name: config.brevoSenderName, email: config.brevoSenderEmail },
          to: [{ email: lead.email, name: lead.name }],
          subject: emailSubject,
          htmlContent: htmlContent
        },
        {
          headers: {
            'api-key': config.brevoApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        }
      );

      logger.success(`Outreach successfully delivered to ${lead.name}.`);
      successCount++;

    } catch (error) {
      // Resilience guard: Ensure an individual delivery failure won't stop other emails from flying
      logger.error(`Failed to deliver email message to ${lead.email}. Skipping contact entry.`, error);
    }
  }

  logger.divider();
  logger.success(`Delivery sequence complete. Successfully dispatched ${successCount}/${approvedLeads.length} emails.`);
}
