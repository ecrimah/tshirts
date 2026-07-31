import { queryOne } from '@/lib/db';

export type MoolreVerifyResult = {
  verified: boolean;
  amount?: number;
  status?: string;
  transactionId?: string;
  raw?: unknown;
};

function moolreCredentials(): { user: string; pubkey: string; account: string } | null {
  const user = process.env.MOOLRE_API_USER;
  const pubkey = process.env.MOOLRE_API_PUBKEY;
  const account = process.env.MOOLRE_ACCOUNT_NUMBER;
  if (!user || !pubkey || !account) return null;
  return { user, pubkey, account };
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

function parseTxPayload(checkResult: Record<string, unknown>): {
  verified: boolean;
  amount?: number;
  status?: string;
  transactionId?: string;
} {
  const data = checkResult.data as Record<string, unknown> | unknown[] | null | undefined;
  const tx = Array.isArray(data)
    ? (data[0] as Record<string, unknown> | undefined)
    : data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : undefined;

  const txStatus = tx?.txstatus ?? tx?.txtstatus ?? tx?.status;
  const statusStr = String(txStatus ?? checkResult.message ?? '').toLowerCase();
  const txOk =
    txStatus === 1 ||
    txStatus === '1' ||
    statusStr === 'success' ||
    statusStr === 'successful' ||
    statusStr === 'completed' ||
    statusStr === 'paid';

  const verified = checkResult.status === 1 && !!tx && txOk;
  const amountRaw = tx?.amount ?? tx?.value;
  const amount = amountRaw != null ? parseFloat(String(amountRaw)) : undefined;
  const transactionId =
    tx?.transactionid != null
      ? String(tx.transactionid)
      : tx?.thirdpartyref != null
        ? String(tx.thirdpartyref)
        : undefined;

  return {
    verified,
    amount: Number.isFinite(amount as number) ? amount : undefined,
    status: statusStr || undefined,
    transactionId,
  };
}

/**
 * Fetch gateway status via official Payment Status API.
 * Docs: POST https://api.moolre.com/open/transact/status
 */
export async function fetchMoolrePaymentStatus(externalRef: string): Promise<MoolreVerifyResult> {
  const creds = moolreCredentials();
  if (!creds || !externalRef) {
    return { verified: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const checkResponse = await fetch('https://api.moolre.com/open/transact/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-USER': creds.user,
        'X-API-PUBKEY': creds.pubkey,
      },
      body: JSON.stringify({
        type: 1,
        idtype: '1',
        id: externalRef,
        accountnumber: creds.account,
      }),
      signal: controller.signal,
    });

    const contentType = checkResponse.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await checkResponse.text();
      console.warn('[Moolre] non-JSON status response:', checkResponse.status, text.slice(0, 200));
      return { verified: false, status: `http_${checkResponse.status}` };
    }

    const checkResult = (await checkResponse.json()) as Record<string, unknown>;
    const parsed = parseTxPayload(checkResult);
    return { ...parsed, raw: checkResult };
  } catch (err) {
    console.warn('[Moolre] status fetch failed:', err instanceof Error ? err.message : err);
    return { verified: false };
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyMoolrePayment(
  externalRef: string,
  expectedTotal?: number
): Promise<MoolreVerifyResult> {
  const result = await fetchMoolrePaymentStatus(externalRef);
  if (!result.verified) {
    return result;
  }

  if (expectedTotal != null && result.amount != null) {
    if (Math.abs(result.amount - expectedTotal) > 0.01) {
      return { ...result, verified: false };
    }
  }

  return result;
}

export async function resolveMoolreExternalRefForOrder(orderNumber: string): Promise<string> {
  const stored = await getStoredMoolreExternalRef(orderNumber);
  if (stored) return stored;
  return orderNumber;
}

export function callbackIndicatesSuccess(body: Record<string, unknown>): boolean {
  const data = (body.data || {}) as Record<string, unknown>;
  const apiStatus = body.status;
  const txStatus = data.txtstatus ?? data.txstatus;
  const messageStr = String(body.message || '').toLowerCase();
  const apiOk = apiStatus === 1 || apiStatus === '1';
  const txOk = txStatus === 1 || txStatus === '1';
  return (apiOk || txOk) && !messageStr.includes('fail') && !messageStr.includes('error');
}
