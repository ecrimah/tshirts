import { NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'fs';
import path from 'path';
import { Readable } from 'stream';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ path: string[] }> };

function uploadRoot() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
}

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(_request: Request, context: Ctx) {
  const { path: parts } = await context.params;
  if (!parts?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const rel = parts.join('/');
  if (rel.includes('..') || path.isAbsolute(rel)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const abs = path.join(uploadRoot(), ...parts);
  const root = path.resolve(uploadRoot());
  if (!abs.startsWith(root) || !existsSync(abs) || !statSync(abs).isFile()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const stream = createReadStream(abs);
  const webStream = Readable.toWeb(stream) as ReadableStream;
  return new NextResponse(webStream, {
    headers: {
      'Content-Type': contentTypeFor(abs),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
