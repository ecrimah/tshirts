import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { verifyAuth } from '@/lib/auth';
import { compressImageBuffer } from '@/lib/image-compress';

export const runtime = 'nodejs';

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

function uploadRoot() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
}

function publicBase() {
  const base =
    process.env.NEXT_PUBLIC_UPLOAD_BASE_URL ||
    `${(process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')}/uploads`;
  return base.replace(/\/+$/, '');
}

function extFor(contentType: string, originalName: string) {
  const fromName = path.extname(originalName || '').toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('gif')) return '.gif';
  if (contentType.includes('svg')) return '.svg';
  return '.jpg';
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const blob = file as File;
    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 12MB)' }, { status: 400 });
    }

    let contentType = blob.type || 'application/octet-stream';
    if (!ALLOWED.has(contentType) && !contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are allowed' }, { status: 400 });
    }

    const raw = Buffer.from(await blob.arrayBuffer());
    const compressed = await compressImageBuffer(raw, contentType);
    const buffer = Buffer.from(compressed.buffer);
    contentType = compressed.contentType;

    const folder = String(form.get('folder') || 'products').replace(/[^a-z0-9_-]/gi, '') || 'products';
    const ext = extFor(contentType, blob.name);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const relative = path.posix.join(folder, filename);
    const absDir = path.join(uploadRoot(), folder);
    const absPath = path.join(uploadRoot(), folder, filename);

    await mkdir(absDir, { recursive: true });
    await writeFile(absPath, buffer);

    const url = `${publicBase()}/${relative}`;
    return NextResponse.json({
      url,
      path: `/${relative}`,
      contentType,
      size: buffer.length,
    });
  } catch (err: unknown) {
    console.error('[uploads POST]', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
