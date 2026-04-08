// netlify/functions/unsubscribe.ts
import type { Handler, HandlerEvent } from '@netlify/functions';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const handler: Handler = async (event: HandlerEvent) => {
  const method = event.httpMethod;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: '',
    };
  }

  // Support both GET (from email link) and POST (from frontend)
  if (method !== 'GET' && method !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'allow': 'GET, POST',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    };
  }

  // Common headers
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  try {
    let email: string;

    if (method === 'GET') {
      // Handle unsubscribe link from email (query parameter)
      const params = new URLSearchParams(event.queryStringParameters || {});
      email = params.get('email') || '';
    } else {
      // Handle POST from frontend
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
      email = body.email || '';
    }

    // Validate email
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Valid email address required' }),
      };
    }

    const trimmedEmail = email.trim().toLowerCase();

    console.log(`[unsubscribe] Unsubscribe request for: ${trimmedEmail}`);

    // Send confirmation email
    const { data, error } = await resend.emails.send({
      from: 'Ritchie Realty <newsletter@ritchierealty.com>',
      to: trimmedEmail,
      subject: 'You have been unsubscribed from Ritchie Realty Newsletter',
      text: `You have successfully unsubscribed from our newsletter.\n\nYou will no longer receive updates from Ritchie Realty.\n\nIf this was a mistake, you can resubscribe at any time on our website.\n\nBest regards,\nThe Ritchie Realty Team`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin:0; padding:0; background:#f4f4f4; font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="background: #001F3F; color: white; padding: 35px 20px; text-align: center;">
                <h1 style="margin:0; font-size: 26px;">Unsubscribed Successfully</h1>
              </div>
              
              <div style="padding: 40px 30px; color: #333; line-height: 1.6; text-align: center;">
                <p>Hi there,</p>
                <p>You have been successfully removed from the Ritchie Realty newsletter.</p>
                <p>You will no longer receive market updates, new listings, or promotional emails from us.</p>
                <p style="margin-top: 30px;">If this was done by mistake, you can easily <a href="${process.env.FRONTEND_URL || 'https://ritchierealty.com'}/#subscribe" style="color: #001F3F;">resubscribe here</a>.</p>
                <p><strong>The Ritchie Realty Team</strong></p>
              </div>
              
              <div style="background: #f9f9f9; padding: 25px; font-size: 13px; color: #777; text-align: center;">
                <p>This is a confirmation email.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('[unsubscribe] Resend error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Failed to send confirmation email' }),
      };
    }

    console.log(`[unsubscribe] Confirmation email sent → ID: ${data?.id}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'You have been successfully unsubscribed.',
      }),
    };

  } catch (err: any) {
    console.error('[unsubscribe] Unexpected error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Server error' }),
    };
  }
};
