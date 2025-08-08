import dotenv from 'dotenv';
dotenv.config();

import { sendEmail } from './email';

async function main() {
  const to = process.argv[2] || process.env.TEST_EMAIL || 'admin@chrono.ninja';
  const subject = process.argv[3] || 'Хронониндзя: тестовое письмо (Resend)';
  const html = process.argv[4] || `<div style="font-family:Arial,sans-serif"><h2>Тест отправки</h2><p>Это тестовое письмо через Resend API.</p></div>`;

  try {
    console.log(`Sending test email to ${to} ...`);
    await sendEmail(to, subject, html);
    console.log('✅ Sent');
  } catch (e) {
    console.error('❌ Failed to send:', e);
    process.exit(1);
  }
}

main();


