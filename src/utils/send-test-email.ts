import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { sendEmail } from './email';

function readHtmlArg(argv: string[]): string {
  const arg4 = argv[4];
  if (!arg4) return `<div style="font-family:Arial,sans-serif"><h2>Тест отправки</h2><p>Это тестовое письмо через Resend API.</p></div>`;
  if (arg4.startsWith('@')) {
    const filePath = path.resolve(process.cwd(), arg4.slice(1));
    return fs.readFileSync(filePath, 'utf8');
  }
  const fileFlag = argv.find((a) => a?.startsWith?.('--file='));
  if (fileFlag) {
    const filePath = path.resolve(process.cwd(), fileFlag.split('=')[1]);
    return fs.readFileSync(filePath, 'utf8');
  }
  return argv.slice(4).join(' ');
}

async function main() {
  const to = process.argv[2] || process.env.TEST_EMAIL || 'admin@chrono.ninja';
  const subject = process.argv[3] || 'Хронониндзя: тестовое письмо (Resend)';
  const html = readHtmlArg(process.argv as any);

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


