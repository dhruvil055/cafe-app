import nodemailer from 'nodemailer';

/**
 * Check if SMTP credentials are provided in environment
 */
export const isEmailConfigured = () => {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  return Boolean(user && pass);
};

/**
 * Build Nodemailer transporter
 */
const getTransporter = () => {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!user || !pass) return null;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const isGmail = process.env.SMTP_SERVICE === 'gmail' || host.includes('gmail.com') || (user && user.includes('gmail.com'));

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
};

/**
 * Send Verification Code Email for Café Onboarding
 */
export const sendVerificationCodeEmail = async ({ to, cafeName, code }) => {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"BrewHaus Café" <${process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@brewhauscafe.com'}>`;

  if (!transporter) {
    console.warn(`\n======================================================`);
    console.warn(`[EmailService] SMTP credentials not configured in .env!`);
    console.warn(`Recipient: ${to}`);
    console.warn(`Café: ${cafeName}`);
    console.warn(`Verification Code (OTP): >>> ${code} <<<`);
    console.warn(`======================================================\n`);
    return { success: false, reason: 'smtp_not_configured', code };
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Email</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f5f0; margin: 0; padding: 24px; }
        .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e7e5e4; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        .header { text-align: center; margin-bottom: 24px; }
        .title { color: #1c1917; font-size: 22px; font-weight: 800; margin: 8px 0; }
        .subtitle { color: #57534e; font-size: 14px; line-height: 1.5; }
        .code-box { background: #fffbeb; border: 2px dashed #f59e0b; border-radius: 14px; padding: 18px; text-align: center; margin: 24px 0; }
        .code { font-family: monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #b45309; }
        .expire { color: #78716c; font-size: 12px; margin-top: 6px; }
        .footer { text-align: center; font-size: 12px; color: #a8a29e; margin-top: 24px; border-top: 1px solid #f5f5f4; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div style="font-size: 32px;">☕</div>
          <h1 class="title">Verify Your Café Account</h1>
          <p class="subtitle">Welcome to BrewHaus! You are setting up <strong>${cafeName}</strong>. Use the verification code below to confirm your email and launch your café:</p>
        </div>
        <div class="code-box">
          <div class="code">${code}</div>
          <div class="expire">Valid for 15 minutes</div>
        </div>
        <p class="subtitle" style="font-size: 13px;">If you did not request this email, please ignore this message.</p>
        <div class="footer">
          &copy; ${new Date().getFullYear()} BrewHaus Café Platform. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const sendPromise = transporter.sendMail({
      from,
      to,
      subject: `${code} is your BrewHaus verification code`,
      text: `Your verification code for ${cafeName} is: ${code}. Valid for 15 minutes.`,
      html,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('SMTP send timed out after 8s')), 8000)
    );

    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log(`[EmailService] Verification code sent to ${to}: messageId=${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailService] Failed to send email to ${to}:`, error.message);
    throw error;
  }
};

/**
 * Send Welcome Email after successful onboarding
 */
export const sendWelcomeEmail = async ({ to, cafeName, adminUrl }) => {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"BrewHaus Café" <${process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@brewhauscafe.com'}>`;

  if (!transporter) return { success: false, reason: 'smtp_not_configured' };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to BrewHaus</title>
    </head>
    <body style="font-family: sans-serif; background-color: #f7f5f0; padding: 24px;">
      <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 32px; border: 1px solid #e7e5e4;">
        <h2 style="color: #1c1917; margin-top: 0;">🎉 Welcome to BrewHaus, ${cafeName}!</h2>
        <p style="color: #57534e; font-size: 14px; line-height: 1.5;">Your café has been created with demo menu categories and QR codes ready for your tables.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${adminUrl}" style="background-color: #d97706; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">Open Café Dashboard</a>
        </div>
        <p style="color: #78716c; font-size: 12px;">Need help? Contact support anytime.</p>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: `Welcome to BrewHaus - ${cafeName} is live!`,
      text: `Your café ${cafeName} is live! Visit your dashboard: ${adminUrl}`,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailService] Failed to send welcome email:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send Password Reset Email
 */
export const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"BrewHaus Café" <${process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@brewhauscafe.com'}>`;

  if (!transporter) {
    console.warn(`[EmailService] SMTP not configured. Password reset link for ${to}: ${resetUrl}`);
    return { success: false, reason: 'smtp_not_configured' };
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: sans-serif; background-color: #f7f5f0; padding: 24px;">
      <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 32px; border: 1px solid #e7e5e4;">
        <h2 style="color: #1c1917; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #57534e; font-size: 14px;">We received a request to reset the password for your account. Click the button below to choose a new password:</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #d97706; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #78716c; font-size: 12px;">This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: `Reset your BrewHaus password`,
      text: `Reset your password by visiting: ${resetUrl}`,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailService] Failed to send password reset email:`, error.message);
    throw error;
  }
};
