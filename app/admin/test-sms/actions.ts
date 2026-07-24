'use server';

import { cookies } from 'next/headers';
import { verifySessionToken, isStaffRole, AUTH_COOKIE_NAME } from '@/lib/auth/token';

export async function testSmsAction(phone: string, message: string) {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE_NAME())?.value;
  if (!token) {
    return { success: false, error: 'Unauthorized: missing session' };
  }

  const session = await verifySessionToken(token);
  if (!session || !isStaffRole(session.role)) {
    return { success: false, error: 'Unauthorized: Admin access required' };
  }

  try {
    console.log('Testing SMS to:', phone, '| by user:', session.email);

    const smsVasKey = process.env.MOOLRE_SMS_API_KEY;
    if (!smsVasKey) {
      return {
        success: false,
        error: 'Missing MOOLRE_SMS_API_KEY environment variable',
      };
    }

    if (!phone || typeof phone !== 'string') {
      return { success: false, error: 'Invalid phone number' };
    }

    if (!message || typeof message !== 'string' || message.length > 1000) {
      return { success: false, error: 'Invalid or too long message' };
    }

    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '233' + cleaned.slice(1);
    }
    if (!cleaned.startsWith('233') && cleaned.length === 9) {
      cleaned = '233' + cleaned;
    }
    const recipient = '+' + cleaned;

    const response = await fetch('https://api.moolre.com/open/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-VASKEY': smsVasKey,
      },
      body: JSON.stringify({
        type: 1,
        senderid: process.env.MOOLRE_SMS_SENDER_ID || 'Mamator',
        messages: [
          {
            recipient,
            message,
          },
        ],
      }),
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { rawResponse: responseText };
    }

    return {
      success: result?.status === 1,
      result,
      formattedPhone: recipient,
      httpStatus: response.status,
    };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'SMS sending failed';
    console.error('[Test SMS] Error:', errMessage);
    return {
      success: false,
      error: errMessage,
    };
  }
}
