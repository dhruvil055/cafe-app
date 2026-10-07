import nodemailer from 'nodemailer';

/**
 * Check if email service is configured (via Resend HTTP API, Brevo HTTP API, or SMTP)
 */
export const isEmailConfigured = () => {
  const hasRelay = Boolean(process.env.GMAIL_RELAY_URL);
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasBrevo = Boolean(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  return hasRelay || hasResend || hasBrevo || Boolean(user && pass);
};

/**
 * Send email via Resend HTTP REST API (port 443 HTTPS, bypasses Render free tier SMTP blocks)
 */
const sendViaHttp = async ({ to, subject, html, text }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  // Resend strictly prohibits sending from @gmail.com / public webmail domains.
  // Use RESEND_FROM if provided, otherwise only use SMTP_FROM if it's not a free webmail domain.
  let from = process.env.RESEND_FROM;
  if (!from) {
    const candidate = process.env.SMTP_FROM || '';
    const isPublicWebmail = /@(gmail|googlemail|yahoo|outlook|hotmail|icloud)\.com/i.test(candidate);
    from = candidate && !isPublicWebmail ? candidate : 'BrewHaus <onboarding@resend.dev>';
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.message || data.error || (data.name ? `${data.name}: ${data.message}` : null) || 'Resend HTTP API failed';
    throw new Error(errorMsg);
  }
  return { success: true, messageId: data.id };
};

/**
 * Send email via Brevo HTTP REST API (port 443 HTTPS, bypasses Render SMTP blocks)
 */
const sendViaBrevo = async ({ to, subject, html, text }) => {
  const apiKey = String(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '').trim();
  if (!apiKey) return null;

  const senderEmail = String(process.env.BREVO_FROM || process.env.SMTP_USER || 'infinigrowsoftech@gmail.com').trim();
  const senderName = String(process.env.BREVO_NAME || 'BrewHaus Café').trim();

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: (Array.isArray(to) ? to : [to]).map((email) => ({ email })),
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.message || data.error || (data.code ? `${data.code}: ${data.message}` : null) || `Brevo HTTP API failed (status ${res.status})`;
    throw new Error(errorMsg);
  }
  return { success: true, messageId: data.messageId };
};

/**
 * Send email via Google Apps Script Webhook (native Gmail over port 443 HTTPS)
 */
const sendViaGoogleScript = async ({ to, subject, html, text, cafeName }) => {
  const url = String(process.env.GMAIL_RELAY_URL || '').trim();
  if (!url) return null;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      subject,
      html,
      text,
      senderName: cafeName || process.env.BREVO_NAME || 'BrewHaus Café',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const errorMsg = data.error || data.message || `Google Script Relay failed with status ${res.status}`;
    throw new Error(errorMsg);
  }
  return { success: true, messageId: data.messageId || 'gmail-script-ok' };
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
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });
};

/**
 * Multi-channel email dispatcher:
 * 1. Google Apps Script Gmail relay (port 443)
 * 2. Resend HTTP REST API (port 443)
 * 3. Brevo HTTP REST API (port 443)
 * 4. Nodemailer SMTP (ports 587/465)
 * 5. Fallback logging
 */
export const dispatchEmail = async ({ to, subject, html, text, cafeName }) => {
  let lastFailure = null;

  // 1. Try Google Apps Script native Gmail relay
  if (process.env.GMAIL_RELAY_URL) {
    try {
      const relayResult = await sendViaGoogleScript({ to, subject, html, text, cafeName });
      if (relayResult?.success) {
        console.log(`[EmailService] Email sent to ${to} via Gmail Relay`);
        return relayResult;
      }
    } catch (relayErr) {
      lastFailure = `Gmail Relay: ${relayErr.message}`;
      console.warn(`[EmailService] Gmail Relay dispatch warning:`, relayErr.message);
    }
  }

  // 2. Try Resend HTTP API
  if (process.env.RESEND_API_KEY) {
    try {
      const httpResult = await sendViaHttp({ to, subject, html, text });
      if (httpResult?.success) {
        console.log(`[EmailService] Email sent to ${to} via Resend HTTP: id=${httpResult.messageId}`);
        return httpResult;
      }
    } catch (httpErr) {
      lastFailure = `Resend: ${httpErr.message}`;
      console.warn(`[EmailService] Resend HTTP dispatch warning:`, httpErr.message);
    }
  }

  // 2. Try Brevo HTTP API
  if (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY) {
    try {
      const brevoResult = await sendViaBrevo({ to, subject, html, text });
      if (brevoResult?.success) {
        console.log(`[EmailService] Email sent to ${to} via Brevo HTTP: id=${brevoResult.messageId}`);
        return brevoResult;
      }
    } catch (brevoErr) {
      lastFailure = `Brevo: ${brevoErr.message}`;
      console.warn(`[EmailService] Brevo HTTP dispatch warning:`, brevoErr.message);
    }
  }

  // 3. Try Nodemailer SMTP
  const transporter = getTransporter();
  if (transporter) {
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"BrewHaus Café" <${process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@brewhauscafe.com'}>`;
    try {
      const sendPromise = transporter.sendMail({ from, to, subject, text, html });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SMTP timed out (Render blocks outbound SMTP ports 25, 465, 587; set BREVO_API_KEY on Render dashboard)')), 5000)
      );
      const info = await Promise.race([sendPromise, timeoutPromise]);
      console.log(`[EmailService] Email sent to ${to} via SMTP: messageId=${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (smtpErr) {
      lastFailure = lastFailure || `SMTP: ${smtpErr.message}`;
      console.warn(`[EmailService] SMTP delivery failed: ${smtpErr.message}`);
    }
  } else if (!lastFailure) {
    lastFailure = 'Email service not configured. Add BREVO_API_KEY in Render environment.';
  }

  // Fallback: Delivery failed or blocked
  console.warn(`\n======================================================`);
  console.warn(`[EmailService] Note: Email not delivered via external network.`);
  console.warn(`Recipient: ${to}`);
  if (cafeName) console.warn(`Café: ${cafeName}`);
  console.warn(`Subject: ${subject}`);
  console.warn(`Reason: ${lastFailure}`);
  console.warn(`======================================================\n`);
  return { success: false, reason: lastFailure };
};

/**
 * Send Verification Code Email for Café Onboarding
 */
export const sendVerificationCodeEmail = async ({ to, cafeName, code }) => {
  const subject = `${code} is your BrewHaus verification code`;
  const text = `Your verification code for ${cafeName} is: ${code}. Valid for 15 minutes.`;

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

  console.log(`[EmailService] Verification Code (OTP) for ${to} (${cafeName}): >>> ${code} <<<`);

  const dispatchResult = await dispatchEmail({ to, subject, html, text, cafeName });
  if (dispatchResult?.success) {
    return dispatchResult;
  }
  return { success: false, reason: dispatchResult?.reason || 'delivery_failed', code };
};

/**
 * Send Welcome Email after successful onboarding
 */
export const sendWelcomeEmail = async ({ to, cafeName, adminUrl }) => {
  const subject = `Welcome to BrewHaus - ${cafeName} is live!`;
  const text = `Your café ${cafeName} is live! Visit your dashboard: ${adminUrl}`;
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

  return dispatchEmail({ to, subject, html, text, cafeName });
};

/**
 * Send Password Reset Email
 */
export const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  const subject = `Reset your BrewHaus password`;
  const text = `Reset your password by visiting: ${resetUrl}`;
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

  return dispatchEmail({ to, subject, html, text });
};

