import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { extractFromZip } from '@/lib/import/zip-extractor';
import { parseCSV, type ValidationWarning } from '@/lib/import/csv-parser';
import { uploadProductImages, collectReferencedImageNames } from '@/lib/import/image-processor';
import {
  buildCategoryLookup,
  getExistingProductNames,
  getExistingProductIdsByName,
  createProductsFromRows,
  type CreateProductResult,
} from '@/lib/import/product-creator';

const MAX_ZIP_BYTES = 500 * 1024 * 1024; // 500MB
const MAX_CSV_BYTES = 10 * 1024 * 1024;  // 10MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB per image

function sseMessage(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const rateLimitKey = `import:${auth.user.id}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.productImport);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many imports. Please try again later.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const zipFile = formData.get('zipFile') as File | null;
  const csvFile = formData.get('csvFile') as File | null;
  const updateExisting = formData.get('updateExisting') === 'true';

  const isZipMode = !!zipFile?.size;
  if (isZipMode) {
    if (zipFile.size > MAX_ZIP_BYTES) {
      return NextResponse.json({ error: 'ZIP file exceeds 500MB limit' }, { status: 400 });
    }
  } else {
    if (!csvFile?.size) {
      return NextResponse.json({ error: 'Either upload a ZIP file or a CSV file' }, { status: 400 });
    }
    if (csvFile.size > MAX_CSV_BYTES) {
      return NextResponse.json({ error: 'CSV file exceeds 10MB limit' }, { status: 400 });
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(sseMessage(event, data)));
      };

      const startTime = Date.now();
      let csvRaw: string;
      let images = new Map<string, Buffer>();

      try {
        if (isZipMode) {
          send('progress', { phase: 'extracting', current: 0, total: 1, message: 'Extracting files...' });
          const buf = Buffer.from(await zipFile.arrayBuffer());
          const extracted = await extractFromZip(buf);
          csvRaw = extracted.csvRaw;
          for (const [k, v] of extracted.images) {
            images.set(k, v);
          }
        } else {
          if (!csvFile) {
            send('error', { message: 'CSV file is required' });
            controller.close();
            return;
          }
          csvRaw = await csvFile.text();
          const imageFiles = formData.getAll('images') as File[];
          for (const file of imageFiles) {
            if (!file?.size || file.size > MAX_IMAGE_BYTES) continue;
            const name = (file.name ?? '').trim().toLowerCase();
            if (!name) continue;
            const buf = Buffer.from(await file.arrayBuffer());
            images.set(name, buf);
          }
        }
      } catch (err: any) {
        send('error', { message: err.message || 'Failed to read upload' });
        controller.close();
        return;
      }

      send('progress', { phase: 'validating', current: 0, total: 1, message: 'Validating CSV...' });

      const imageKeys = new Set(images.keys());
      const { rows, errors: validationErrors, warnings } = parseCSV(csvRaw, imageKeys);

      const criticalRows = new Set(
        validationErrors.filter((e) => e.field === 'name' || e.field === 'price').map((e) => e.row)
      );
      const validRows = rows.filter((r) => r.name && r.price != null && r.price >= 0 && !criticalRows.has(r.rowIndex));

      for (const e of validationErrors) {
        send('product', { row: e.row, name: '', status: 'error', error: e.message });
      }

      if (validRows.length === 0 && validationErrors.length > 0) {
        send('complete', {
          summary: {
            totalRows: rows.length + validationErrors.length,
            productsCreated: 0,
            variantsCreated: 0,
            imagesUploaded: 0,
            errors: validationErrors.length,
            warnings: warnings.length,
            skipped: 0,
            duration: `${Math.round((Date.now() - startTime) / 1000)}s`,
          },
          errors: validationErrors,
          warnings,
        });
        controller.close();
        return;
      }

      let categoryLookup = { byName: new Map<string, string>() };
      let existingNames = new Set<string>();
      let existingIdsByName = new Map<string, string>();
      try {
        categoryLookup = await buildCategoryLookup();
        existingNames = await getExistingProductNames();
        existingIdsByName = await getExistingProductIdsByName();
      } catch (_) {}

      const referencedNames = collectReferencedImageNames(validRows);
      const prefix = `imports/${Date.now()}`;

      send('progress', {
        phase: 'uploading_images',
        current: 0,
        total: referencedNames.size,
        message: 'Uploading images...',
      });

      const imageUrlMap = await uploadProductImages(
        images,
        referencedNames,
        prefix,
        (p) => send('progress', { phase: 'uploading_images', ...p })
      );

      send('progress', {
        phase: 'creating_products',
        current: 0,
        total: validRows.length,
        message: 'Creating products...',
      });

      const results: CreateProductResult[] = [];
      const { created, variants, errors: createErrors, skipped } = await createProductsFromRows(
        validRows,
        imageUrlMap,
        categoryLookup,
        existingNames,
        existingIdsByName,
        updateExisting,
        (r) => {
          results.push(r);
          send('product', {
            row: r.rowIndex,
            name: r.name,
            status: r.status,
            error: r.error,
            skipped: r.skipped,
          });
        }
      );

      const categoryWarnings: ValidationWarning[] = [];
      for (const row of validRows) {
        if (row.category?.trim() && !categoryLookup.byName.has(row.category.trim().toLowerCase())) {
          categoryWarnings.push({
            row: row.rowIndex,
            field: 'category',
            message: `Category '${row.category}' not found. Product created without category.`,
          });
        }
      }
      const allWarnings = [...warnings, ...categoryWarnings];
      const totalErrors = validationErrors.length + createErrors;
      const duration = `${Math.round((Date.now() - startTime) / 1000)}s`;

      send('complete', {
        summary: {
          totalRows: rows.length,
          productsCreated: created,
          variantsCreated: variants,
          imagesUploaded: imageUrlMap.size,
          errors: totalErrors,
          warnings: allWarnings.length,
          skipped,
          duration,
        },
        errors: validationErrors,
        warnings: allWarnings,
      });

      try {
        await supabaseAdmin.from('audit_logs').insert({
          user_id: auth.user.id,
          action: 'product_import',
          entity_type: 'import',
          entity_id: null,
          details: {
            productsCreated: created,
            variantsCreated: variants,
            imagesUploaded: imageUrlMap.size,
            errors: totalErrors,
            warnings: warnings.length,
            skipped,
            duration,
            updateExisting,
          },
          ip_address: getClientIdentifier(request),
        });
      } catch (_) {}

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  });
}
