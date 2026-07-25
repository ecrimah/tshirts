import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export function GET() {
  const candidates = ['favicon-32.png', 'favicon-16.png', 'logo.png'];
  for (const name of candidates) {
    try {
      const filePath = path.join(process.cwd(), 'public', name);
      const buffer = fs.readFileSync(filePath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800, immutable',
        },
      });
    } catch {
      continue;
    }
  }
  return new NextResponse(null, { status: 404 });
}
