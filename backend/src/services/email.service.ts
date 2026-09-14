import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let transporter: nodemailer.Transporter | null = null;
let testAccount: nodemailer.TestAccount | null = null;

export async function initEmailTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (config.ethereal.user && config.ethereal.pass) {
    console.log('[EmailService] Using configured Ethereal credentials from environment.');
    transporter = nodemailer.createTransport({
      host: config.ethereal.host,
      port: config.ethereal.port,
      secure: false,
      auth: {
        user: config.ethereal.user,
        pass: config.ethereal.pass,
      },
    });
  } else {
    console.log('[EmailService] Generating fresh Ethereal test account...');
    testAccount = await nodemailer.createTestAccount();
    console.log(`[EmailService] Ethereal account generated: User=${testAccount.user}`);
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  // Verify connection configuration
  // Verify connection configuration, but don't prevent the API
// from starting if the SMTP server is temporarily unreachable.
try {
  await transporter.verify();
  console.log('[EmailService] Ethereal SMTP transporter verified successfully.');
} catch (error: any) {
  console.warn(
    '[EmailService] SMTP verification failed, but the API will continue:',
    error.message
  );
}

return transporter;
}

export interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmail(options: SendMailOptions): Promise<SendMailResult> {
  const mailTransporter = await initEmailTransporter();

  const info = await mailTransporter.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    text: options.text || options.html?.replace(/<[^>]*>?/gm, '') || '',
    html: options.html || options.text || '',
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`[EmailService] Email sent to ${options.to}. MessageId: ${info.messageId}`);
  if (previewUrl) {
    console.log(`[EmailService] Ethereal Preview URL: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl,
  };
}
