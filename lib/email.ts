import nodemailer from 'nodemailer';
import { Participant } from './excel';
import { Readable } from 'stream';

export function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error('SMTP credentials are not fully configured in environment variables.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
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
    text: `Dear ${participant.memberName},\n\nThank you for participating in the NexHack Online Round.\n\nPlease find your participation certificate attached to this email.\n\nRegards,\nNexHack Team`,
    attachments: [
      {
        filename: filename,
        content: attachmentStream as Readable,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
}
