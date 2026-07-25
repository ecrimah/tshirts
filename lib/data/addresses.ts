import { query, queryOne } from '@/lib/db';

export type AddressRow = {
  id: string;
  user_id: string;
  type: string;
  is_default: boolean;
  label: string | null;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  created_at: string;
  updated_at: string;
};

export type AddressInput = {
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postal_code?: string | null;
  country?: string | null;
  label?: string | null;
  is_default?: boolean;
  type?: string;
};

async function clearOtherDefaults(userId: string, keepId?: string) {
  if (keepId) {
    await query(
      `UPDATE addresses SET is_default = false, updated_at = now()
       WHERE user_id = $1::uuid AND id <> $2::uuid AND is_default = true`,
      [userId, keepId]
    );
  } else {
    await query(
      `UPDATE addresses SET is_default = false, updated_at = now()
       WHERE user_id = $1::uuid AND is_default = true`,
      [userId]
    );
  }
}

export async function listAddressesForUser(userId: string): Promise<AddressRow[]> {
  const result = await query<AddressRow>(
    `SELECT * FROM addresses
     WHERE user_id = $1::uuid
     ORDER BY is_default DESC, updated_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function createAddress(userId: string, input: AddressInput): Promise<AddressRow> {
  const makeDefault = Boolean(input.is_default);
  if (makeDefault) await clearOtherDefaults(userId);

  // First address becomes default automatically
  const existing = await queryOne<{ count: string }>(
    `SELECT count(*)::text AS count FROM addresses WHERE user_id = $1::uuid`,
    [userId]
  );
  const isFirst = Number(existing?.count || 0) === 0;
  const isDefault = makeDefault || isFirst;

  const row = await queryOne<AddressRow>(
    `INSERT INTO addresses (
       user_id, type, is_default, label, full_name, phone,
       address_line1, address_line2, city, state, postal_code, country
     ) VALUES (
       $1::uuid, $2::address_type, $3, $4, $5, $6,
       $7, $8, $9, $10, $11, $12
     ) RETURNING *`,
    [
      userId,
      input.type || 'shipping',
      isDefault,
      input.label || null,
      input.full_name.trim(),
      input.phone.trim(),
      input.address_line1.trim(),
      input.address_line2?.trim() || null,
      input.city.trim(),
      input.state.trim(),
      (input.postal_code || '-').trim() || '-',
      (input.country || 'Ghana').trim() || 'Ghana',
    ]
  );
  if (!row) throw new Error('Failed to create address');
  return row;
}

export async function updateAddress(
  userId: string,
  id: string,
  input: Partial<AddressInput>
): Promise<AddressRow | null> {
  const current = await queryOne<AddressRow>(
    `SELECT * FROM addresses WHERE id = $1::uuid AND user_id = $2::uuid`,
    [id, userId]
  );
  if (!current) return null;

  if (input.is_default) await clearOtherDefaults(userId, id);

  const row = await queryOne<AddressRow>(
    `UPDATE addresses SET
       full_name = COALESCE($3, full_name),
       phone = COALESCE($4, phone),
       address_line1 = COALESCE($5, address_line1),
       address_line2 = COALESCE($6, address_line2),
       city = COALESCE($7, city),
       state = COALESCE($8, state),
       postal_code = COALESCE($9, postal_code),
       country = COALESCE($10, country),
       label = COALESCE($11, label),
       is_default = COALESCE($12, is_default),
       updated_at = now()
     WHERE id = $1::uuid AND user_id = $2::uuid
     RETURNING *`,
    [
      id,
      userId,
      input.full_name?.trim() ?? null,
      input.phone?.trim() ?? null,
      input.address_line1?.trim() ?? null,
      input.address_line2 === undefined ? null : input.address_line2?.trim() || null,
      input.city?.trim() ?? null,
      input.state?.trim() ?? null,
      input.postal_code?.trim() ?? null,
      input.country?.trim() ?? null,
      input.label === undefined ? null : input.label,
      input.is_default === undefined ? null : Boolean(input.is_default),
    ]
  );
  return row;
}

export async function deleteAddress(userId: string, id: string): Promise<boolean> {
  const deleted = await queryOne<{ id: string; is_default: boolean }>(
    `DELETE FROM addresses WHERE id = $1::uuid AND user_id = $2::uuid
     RETURNING id, is_default`,
    [id, userId]
  );
  if (!deleted) return false;

  if (deleted.is_default) {
    const next = await queryOne<{ id: string }>(
      `SELECT id FROM addresses WHERE user_id = $1::uuid ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );
    if (next) {
      await query(`UPDATE addresses SET is_default = true WHERE id = $1::uuid`, [next.id]);
    }
  }
  return true;
}

export async function setDefaultAddress(userId: string, id: string): Promise<AddressRow | null> {
  const current = await queryOne<AddressRow>(
    `SELECT * FROM addresses WHERE id = $1::uuid AND user_id = $2::uuid`,
    [id, userId]
  );
  if (!current) return null;
  await clearOtherDefaults(userId, id);
  return queryOne<AddressRow>(
    `UPDATE addresses SET is_default = true, updated_at = now()
     WHERE id = $1::uuid AND user_id = $2::uuid RETURNING *`,
    [id, userId]
  );
}

export {
  addressToShippingData,
  shippingDataToAddressInput,
} from '@/lib/address-map';
