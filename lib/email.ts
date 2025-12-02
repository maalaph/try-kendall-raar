/**
 * Email utility for sending My Kendall welcome emails via Gmail SMTP
 */

import nodemailer from 'nodemailer';

/**
 * Create and configure Gmail SMTP transporter
 */
function createTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPassword) {
    throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD environment variables are required');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
  });
}

/**
 * Send welcome email to customer with their My Kendall phone number and edit link
 */
export async function sendKendallWelcomeEmail({
  to,
  fullName,
  phoneNumber,
  editLink,
  chatLink,
  recordId,
}: {
  to: string;
  fullName: string;
  phoneNumber: string;
  editLink: string;
  chatLink?: string;
  recordId: string;
}) {
  try {
    const transporter = createTransporter();

    // Format phone number for display (remove +1 if present, add formatting)
    const formatPhoneForDisplay = (phone: string): string => {
      // Remove +1 prefix if present
      let cleaned = phone.replace(/^\+1/, '').replace(/\D/g, '');
      
      // Format as (XXX) XXX-XXXX
      if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }
      
      // If already formatted or different format, return as-is
      return phone;
    };

    const formattedPhone = formatPhoneForDisplay(phoneNumber);

    // Get base URL from environment or use relative URL
    // Priority: NEXT_PUBLIC_BASE_URL > https://VERCEL_URL > localhost
    // ✅ Fix: Properly prioritize NEXT_PUBLIC_BASE_URL over VERCEL_URL
    let baseUrl = 'http://localhost:3000';
    if (process.env.NEXT_PUBLIC_BASE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    }
    
    const fullEditLink = editLink.startsWith('http') ? editLink : `${baseUrl}${editLink}`;
    // ✅ Fix: Ensure relative chat links get base URL prepended
    const fullChatLink = chatLink?.startsWith('http') ? chatLink : `${baseUrl}${chatLink || `/chat?recordId=${recordId}`}`;

    const mailOptions = {
      from: `"My Kendall" <${process.env.GMAIL_USER}>`,
      to,
      subject: 'MyKendall Phone Number is Ready!',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>MyKendall Phone Number is Ready!</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="padding: 40px 30px;">
                        <h1 style="margin: 0 0 30px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                          Hi ${fullName},
                        </h1>
                        
                        <div style="margin: 30px 0; padding: 20px; background-color: #f9f9f9; border-radius: 6px; text-align: center;">
                          <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1a1a1a; letter-spacing: 1px;">
                            ${formattedPhone}
                          </p>
                        </div>
                        
                        <p style="margin: 30px 0 20px 0; font-size: 16px; line-height: 1.6; color: #666666;">
                          You can edit your Kendall's personality and settings anytime:
                        </p>
                        
                        <table role="presentation" style="width: 100%; margin: 30px 0;">
                          <tr>
                            <td align="center" style="padding-bottom: 15px;">
                              <a href="${fullChatLink}" 
                                 style="display: inline-block; padding: 14px 32px; background-color: #a855f7; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                                Chat with Kendall
                              </a>
                            </td>
                          </tr>
                          <tr>
                            <td align="center">
                              <a href="${fullEditLink}" 
                                 style="display: inline-block; padding: 14px 32px; background-color: transparent; color: #a855f7; text-decoration: none; border: 2px solid #a855f7; border-radius: 6px; font-weight: 600; font-size: 16px;">
                                Edit My Kendall
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.5; color: #999999; border-top: 1px solid #eeeeee; padding-top: 20px;">
                          Chat with your Kendall anytime to get updates, request calls, or share information. You can also edit your Kendall's personality, voice, and settings as many times as you'd like.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      text: `
Hi ${fullName},

${formattedPhone}

Chat with your Kendall:
${fullChatLink}

Edit your Kendall's personality and settings:
${fullEditLink}

Chat with your Kendall anytime to get updates, request calls, or share information. You can also edit your Kendall's personality, voice, and settings as many times as you'd like.
      `.trim(),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[EMAIL SUCCESS] Welcome email sent:', {
      to,
      messageId: info.messageId,
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send welcome email:', error);
    throw error;
  }
}

/**
 * Send business trial welcome email with next steps
 */
export async function sendBusinessTrialWelcomeEmail({
  to,
  fullName,
  businessName,
}: {
  to: string;
  fullName: string;
  businessName: string;
}) {
  try {
    const transporter = createTransporter();

    // Get base URL from environment or use relative URL
    let baseUrl = 'http://localhost:3000';
    if (process.env.NEXT_PUBLIC_BASE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    }

    const mailOptions = {
      from: `"Kendall Business" <${process.env.GMAIL_USER}>`,
      to,
      subject: 'Welcome to Kendall Business - Next Steps',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Kendall Business</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="padding: 40px 30px;">
                        <h1 style="margin: 0 0 30px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                          Hi ${fullName},
                        </h1>
                        
                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #666666;">
                          Thank you for signing up for Kendall Business! We're excited to help ${businessName} streamline your operations.
                        </p>
                        
                        <p style="margin: 20px 0; font-size: 16px; line-height: 1.6; color: #666666;">
                          We'll be in touch soon with next steps to get your free trial set up. In the meantime, if you have any questions, feel free to reach out.
                        </p>
                        
                        <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.5; color: #999999; border-top: 1px solid #eeeeee; padding-top: 20px;">
                          Welcome to the future of business communication.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      text: `
Hi ${fullName},

Thank you for signing up for Kendall Business! We're excited to help ${businessName} streamline your operations.

We'll be in touch soon with next steps to get your free trial set up. In the meantime, if you have any questions, feel free to reach out.

Welcome to the future of business communication.
      `.trim(),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[EMAIL SUCCESS] Business trial welcome email sent:', {
      to,
      messageId: info.messageId,
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send business trial welcome email:', error);
    throw error;
  }
}
