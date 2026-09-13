import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
let transporter = null;
let testAccount = null;
export async function initEmailTransporter() {
    if (transporter)
        return transporter;
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
    }
    else {
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
    await transporter.verify();
    console.log('[EmailService] Ethereal SMTP transporter verified successfully.');
    return transporter;
}
export async function sendEmail(options) {
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
