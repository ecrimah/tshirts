import { queryOne } from '@/lib/db';

export type MoolreVerifyResult = {
  verified: boolean;
  amount?: number;
  status?: string;
  raw?: unknown;
};

function moolreCredentials(): { user: string; pubkey: string } | null {
  const user = process.env.MOOLRE_API_USER;
  const pubkey = process.env.MOOLRE_API_PUBKEY;
  if (!user || !pubkey) return null;
  return { user, pubkey };
}

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Callback secret is mandatory in production. */
export function assertCallbackSecretConfigured(): void {
  if (isProductionEnv() && !process.env.MOOLRE_CALLBACK_SECRET) {
    throw new Error('MOOLRE_CALLBACK_SECRET is required in production');
  }
}

export function validateCallbackSecret(body: Record<string, unknown>): boolean {
  const expected = process.env.MOOLRE_CALLBACK_SECRET;
  if (!expected) {
    return !isProductionEnv();
  }
  return body.secret === expected;
}

export function parseMerchantOrderRef(rawRef: string): string {
  return rawRef.replace(/-R\d+$/, '');
}

export function extractOrderRefFromCallback(body: Record<string, unknown>): {
  merchantOrderRef: string;
  moolreReference: string;
  rawExternalRef: string;
} {
  const data = (body.data || {}) as Record<string, unknown>;
  const rawExternalRef = String(
    data.externalref ||
      data.external_reference ||
      data.orderRef ||
      body.externalref ||
      body.orderRef ||
      body.external_reference ||
      ''
  );
  const metadata = (data.metadata || body.metadata || {}) as Record<string, unknown>;
  const merchantOrderRef = rawExternalRef
    ? parseMerchantOrderRef(rawExternalRef)
    : String(metadata.original_order_number || '');

  const moolreReference = String(
    data.transactionid || data.thirdpartyref || body.reference || 'callback'
  );

  return { merchantOrderRef, moolreReference, rawExternalRef };
}

/** Latest Moolre externalref stored when payment link was generated. */
export async function getStoredMoolreExternalRef(orderNumber: string): Promise<string | null> {
  const row = await queryOne<{ externalref: string | null }>(
    `SELECT metadata->>'moolre_externalref' AS externalref FROM orders WHERE order_number = $1`,
    [orderNumber]
  );
  return row?.externalref ?? null;
}

export async function verifyMoolrePayment(
  externalRef: string,
  expectedTotal?: number
): Promise<MoolreVerifyResult> {
  const creds = moolreCredentials();
  if (!creds || !externalRef) {
    return { verified: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const checkResponse = await fetch('https://api.moolre.com/embed/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-USER': creds.user,
        'X-API-PUBKEY': creds.pubkey,
      },
      body: JSON.stringify({ externalref: externalRef }),
      signal: controller.signal,
    });

    const checkResult = await checkResponse.json();
    const statusStr = String(checkResult.data?.status || '').toLowerCase();
    const verified =
      checkResult.status === 1 &&
      checkResult.data &&
      (statusStr === 'success' ||
        statusStr === 'successful' ||
        statusStr === 'completed' ||
        statusStr === 'paid');

    if (!verified) {
      return { verified: false, raw: checkResult };
    }

    const amount = checkResult.data?.amount ? parseFloat(String(checkResult.data.amount)) : undefined;
    if (expectedTotal != null && amount != null) {
      if (Math.abs(amount - expectedTotal) > 0.01) {
        return { verified: false, amount, status: statusStr, raw: checkResult };
      }
    }

    return { verified: true, amount, status: statusStr, raw: checkResult };
  } catch (err) {
    console.warn('[Moolre] verify failed:', err instanceof Error ? err.message : err);
    return { verified: false };
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveMoolreExternalRefForOrder(orderNumber: string): Promise<string> {
  const stored = await getStoredMoolreExternalRef(orderNumber);
  if (stored) return stored;
  return orderNumber;
}

export function callbackIndicatesSuccess(body: Record<string, unknown>): boolean {
  const data = (body.data || {}) as Record<string, unknown>;
  const apiStatus = body.status;
  const txStatus = data.txtstatus;
  const messageStr = String(body.message || '').toLowerCase();
  const apiOk = apiStatus === 1 || apiStatus === '1';
  const txOk = txStatus === 1 || txStatus === '1';
  return (apiOk || txOk) && !messageStr.includes('fail') && !messageStr.includes('error');
}
