import sharp from 'sharp';

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 78;

/** Shrink image uploads while keeping the same format (JPEG/PNG/WebP). */
export async function compressImageBuffer(
  input: Buffer,
  contentType: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const ct = (contentType || '').toLowerCase();
  if (!ct.startsWith('image/') || ct.includes('gif') || ct.includes('svg+xml')) {
    return { buffer: input, contentType };
  }

  try {
    let pipeline = sharp(input, { failOn: 'none' }).rotate();
    const meta = await pipeline.metadata();
    if (!meta.width) return { buffer: input, contentType };

    if (
      (meta.width && meta.width > MAX_DIMENSION) ||
      (meta.height && meta.height > MAX_DIMENSION)
    ) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    if (ct.includes('jpeg') || ct.includes('jpg')) {
      const buffer = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
      return buffer.length < input.length
        ? { buffer, contentType: 'image/jpeg' }
        : { buffer: input, contentType };
    }

    if (ct.includes('webp')) {
      const buffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
      return buffer.length < input.length
        ? { buffer, contentType: 'image/webp' }
        : { buffer: input, contentType };
    }

    if (ct.includes('png')) {
      const buffer = await pipeline
        .png({ compressionLevel: 9, effort: 7, palette: !meta.hasAlpha })
        .toBuffer();
      return buffer.length < input.length
        ? { buffer, contentType: 'image/png' }
        : { buffer: input, contentType };
    }
  } catch {
    /* keep original */
  }

  return { buffer: input, contentType };
}
