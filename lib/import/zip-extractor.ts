/**
 * Extract CSV and images from a product-import ZIP archive.
 * ZIP structure: products.csv at root, images/ folder with image files.
 */

import JSZip from 'jszip';

const MAX_TOTAL_BYTES = 1024 * 1024 * 1024; // 1GB ZIP bomb protection
const ALLOWED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export interface ExtractedImport {
  csvRaw: string;
  csvFilename: string;
  images: Map<string, Buffer>;
}

function getExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

export async function extractFromZip(zipBuffer: Buffer): Promise<ExtractedImport> {
  const zip = await JSZip.loadAsync(zipBuffer);
  let totalBytes = 0;

  const csvFiles: { name: string; content: string }[] = [];
  const images = new Map<string, Buffer>();

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const size = (entry as JSZip.JSZipObject & { options?: { uncompressedSize?: number } }).options?.uncompressedSize ?? 0;
    totalBytes += size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error('ZIP contents exceed maximum allowed size (1GB). Aborting.');
    }

    const normalizedPath = path.replace(/\\/g, '/');
    const name = normalizedPath.split('/').pop() ?? path;
    const ext = getExtension(name);

    if (ext === '.csv') {
      const isRoot = !normalizedPath.includes('/') || normalizedPath.split('/').length === 2;
      if (isRoot || normalizedPath.endsWith('.csv')) {
        const text = await (entry as JSZip.JSZipObject).async('string');
        csvFiles.push({ name, content: text });
      }
    } else if (ALLOWED_IMAGE_EXT.has(ext)) {
      const buf = await (entry as JSZip.JSZipObject).async('nodebuffer');
      const key = name.toLowerCase().trim();
      if (!images.has(key)) {
        images.set(key, buf);
      }
    }
  }

  if (csvFiles.length === 0) {
    throw new Error('No CSV file found in the ZIP archive.');
  }
  const primary = csvFiles.find((f) => f.name.toLowerCase() === 'products.csv') ?? csvFiles[0];
  return {
    csvRaw: primary.content,
    csvFilename: primary.name,
    images,
  };
}
