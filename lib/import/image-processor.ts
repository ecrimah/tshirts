/**
 * Upload product images to Supabase Storage and build a map of filename -> public URL.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';

const BUCKET = 'products';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per image
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function getExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

function safeStorageName(original: string): string {
  return original
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
}

export interface UploadProgress {
  current: number;
  total: number;
  message: string;
}

export async function uploadProductImages(
  images: Map<string, Buffer>,
  referencedNames: Set<string>,
  prefix: string,
  onProgress?: (p: UploadProgress) => void
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const toUpload = Array.from(referencedNames).filter((name) => images.has(name));
  const total = toUpload.length;
  let current = 0;

  for (const filename of toUpload) {
    const buf = images.get(filename)!;
    if (buf.length > MAX_FILE_SIZE_BYTES) {
      onProgress?.({
        current: ++current,
        total,
        message: `Skipped ${filename}: exceeds 10MB`,
      });
      continue;
    }
    const ext = getExt(filename);
    if (!ALLOWED_EXT.has(ext)) {
      onProgress?.({
        current: ++current,
        total,
        message: `Skipped ${filename}: unsupported format`,
      });
      continue;
    }

    const base = safeStorageName(filename);
    const path = `${prefix}/${base}`;

    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, {
      contentType: ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg',
      upsert: true,
    });

    if (error) {
      onProgress?.({
        current: ++current,
        total,
        message: `Failed ${filename}: ${error.message}`,
      });
      continue;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    urlMap.set(filename.toLowerCase().trim(), publicUrl);
    urlMap.set(filename, publicUrl);
    current++;
    onProgress?.({
      current,
      total,
      message: `Uploaded ${filename}`,
    });
  }

  return urlMap;
}

export function collectReferencedImageNames(rows: { images?: string[]; variant_image?: string }[]): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    for (const f of row.images ?? []) {
      if (f.trim()) set.add(f.toLowerCase().trim());
    }
    if (row.variant_image?.trim()) {
      set.add(row.variant_image.toLowerCase().trim());
    }
  }
  return set;
}
