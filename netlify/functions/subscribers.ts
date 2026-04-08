// netlify/functions/subscribe.ts
import type { Handler, HandlerEvent } from '@netlify/functions';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const handler: Handler = async (event: HandlerEvent) => {
  const method = event.httpMethod;

  // Handle CORS preflight (OPTIONS)
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  // Only allow POST
  if (method !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'allow': 'POST',                    // lowercase + consistent headers
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    };
  }

  // Common headers for all other responses (POST, errors, success)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  try {
    // Parse JSON body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid JSON body' }),
      };
    }

    const { email } = body;

    // Email validation
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Valid email address required' }),
      };
    }

    const trimmedEmail = email.trim().toLowerCase();

    console.log(`[subscribe] New subscription attempt: ${trimmedEmail}`);

    // HTML email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0; padding:0; background:#f4f4f4; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: #001F3F; color: white; padding: 35px 20px; text-align: center;">
              <h1 style="margin:0; font-size: 28px;">Welcome to Ritchie Realty</h1>
            </div>
            
            <!-- Body -->
            <div style="padding: 35px 30px; color: #333; line-height: 1.6;">
              <p>Hi there,</p>
              <p>Thank you for subscribing! We're thrilled to have you join our community.</p>
              <p>You'll now receive:</p>
              <ul style="padding-left: 20px;">
                <li>Latest market trends in Ritchie County & Pennsboro, WV</li>
                <li>New property listings & exclusive opportunities</li>
                <li>Local real estate insights & tips</li>
              </ul>
              <p style="margin-top: 32px;">Stay tuned for our first update soon!</p>
              <p><strong>The Ritchie Realty Team</strong></p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f9f9f9; padding: 25px 30px; font-size: 13px; color: #777; text-align: center; border-top: 1px solid #eee;">
              <p>You received this email because you subscribed to our newsletter.</p>
              <a 
                href="${process.env.FRONTEND_URL || 'https://ritchierealty.netlify.app/'}/unsubscribe?email=${encodeURIComponent(trimmedEmail)}" 
                style="color: #001F3F; text-decoration: underline;"
              >
                Unsubscribe
              </a>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email with Resend
    const { data, error } = await resend.emails.send({
      from: 'Ritchie Realty <newsletter@ritchierealty.com>',
      to: trimmedEmail,
      subject: 'Welcome to Ritchie Realty Newsletter!',
      text: `Thank you for subscribing!\n\nWe'll keep you updated with the latest real estate news, market trends, and exclusive listings in Pennsboro and Ritchie County, WV.\n\nBest regards,\nThe Ritchie Realty Team`,
      html: htmlContent,
    });

    if (error) {
      console.error('[subscribe] Resend error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Failed to send welcome email' }),
      };
    }

    console.log(`[subscribe] Welcome email sent → ID: ${data?.id}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Thank you! You are now subscribed. Check your inbox.',
      }),
    };

  } catch (err: any) {
    console.error('[subscribe] Unexpected function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Server error' }),
    };
  }
};
