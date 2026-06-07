import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve directory paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredKeys = [
  'OCEAN_API_KEY',
  'PROSPEO_API_KEY',
  'EAZYREACH_API_KEY',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL'
];

// Validate critical keys on boot to ensure fast failure
const missingKeys = requiredKeys.filter(key => !process.env[key]);
if (missingKeys.length > 0) {
  console.error(`\x1b[31m[CONFIG ERROR] Critical initialization failure. Missing keys: ${missingKeys.join(', ')}\x1b[0m`);
  process.exit(1);
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  seedDomain: process.env.SEED_DOMAIN || 'stripe.com',
  oceanApiKey: process.env.OCEAN_API_KEY,
  prospeoApiKey: process.env.PROSPEO_API_KEY,
  brevoApiKey: process.env.BREVO_API_KEY,
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL,
  brevoSenderName: process.env.BREVO_SENDER_NAME || 'Harshal',
  
  // Track state of Eazyreach API mode
  // Track state of Eazyreach API mode
  isEazyreachMocked: process.env.EAZYREACH_API_KEY === 'mock_key_until_whatsapp_reply',
  eazyreachApiKey: process.env.EAZYREACH_API_KEY
};