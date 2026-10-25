import nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';
import { Participant } from './excel';
import { Readable } from 'stream';

// Lazily-initialized singleton — avoids re-creating TCP+TLS connection per email
let _transporter: Transporter | null = null;

export function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error('SMTP credentials are not fully configured in environment variables.');
  }

  _transporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return _transporter;
}


export async function verifySMTPConnection(): Promise<boolean> {
  const transporter = getTransporter();
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('SMTP Connection Error:', error);
    throw error;
  }
}

export async function sendCertificateEmail(
  participant: Participant,
  recipientEmail: string,
  attachmentStream: unknown,
  filename: string
) {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  if (!from) {
    throw new Error('EMAIL_FROM is not configured.');
  }

  const mailOptions = {
    from: `NexHack Team <${from}>`,
    to: recipientEmail,
    subject: 'NexHack — Online Round Participation Certificate',
    text: `Dear ${participant.memberName},\n\nGreetings from NexVerse IITM!\n\nThank you for being a part of NexHack 2.0 and for participating in the Online Evaluation Round. We sincerely appreciate the time, effort, and enthusiasm you put into the evaluation process.\n\nAs a token of appreciation for your participation, we are pleased to share your E-Certificate of Participation with this email.\n\nPlease find your certificate attached.\n\nWe hope you had a meaningful and enriching experience participating in NexHack 2.0.\n\nThank you once again for being a part of NexHack 2.0.\n\nWarm regards,\nTeam NexVerse IITM\nNexHack 2.0`,
    html: `<p>Dear ${participant.memberName},</p>
<p>Greetings from <strong>NexVerse IITM</strong>!</p>
<p>Thank you for being a part of <strong>NexHack 2.0</strong> and for participating in the <strong>Online Evaluation Round</strong>. We sincerely appreciate the time, effort, and enthusiasm you put into the evaluation process.</p>
<p>As a token of appreciation for your participation, we are pleased to share your <strong>E-Certificate of Participation</strong> with this email.</p>
<p>Please find your certificate attached.</p>
<p>We hope you had a meaningful and enriching experience participating in NexHack 2.0.</p>
<p>Thank you once again for being a part of <strong>NexHack 2.0</strong>.</p>
<p>Warm regards,<br>
<strong>Team NexVerse IITM</strong><br>
<em>NexHack 2.0</em></p>`,
    attachments: [
      {
        filename: filename,
        content: attachmentStream as Readable,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
}
