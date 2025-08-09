import nodemailer from 'nodemailer';
import https from 'https';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Хронониндзя Профили <profiles@chrono.ninja>';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    } as any);
  }
  return transporter;
}

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ from: EMAIL_FROM, to, subject, html });
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) return resolve();
        const resp = Buffer.concat(chunks).toString('utf8');
        reject(new Error(`Resend error ${res.statusCode}: ${resp}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (RESEND_API_KEY) {
    return sendViaResend(to, subject, html);
  }
  const tr = getTransporter();
  await tr.sendMail({ from: EMAIL_FROM, to, subject, html });
}


