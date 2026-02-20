/**
 * CSV parsing and validation for product import.
 * Matches ProductForm fields: name, price (required); description, category, compare_at_price,
 * quantity, moq, status (Active/Draft/Archived), featured, seo_title, seo_description, keywords→tags,
 * low_stock_threshold, preorder_shipping, images; variant_color, variant_color_hex, variant_size,
 * variant_price, variant_stock. SKU and slug are auto-generated — no SKU column.
 */

import Papa from 'papaparse';

export const REQUIRED_COLUMNS = ['name', 'price'];
export const STATUS_VALUES_CSV = ['active', 'draft', 'archived'] as const;
export type StatusValue = (typeof STATUS_VALUES_CSV)[number];

const HEX_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ValidationWarning {
  row: number;
  field: string;
  message: string;
}

export interface ParsedProductRow {
  rowIndex: number;
  name: string;
  price: number;
  description?: string;
  category?: string;
  compare_at_price?: number;
  quantity?: number;
  moq?: number;
  status?: StatusValue;
  featured?: boolean;
  seo_title?: string;
  seo_description?: string;
  tags?: string[];
  low_stock_threshold?: number;
  preorder_shipping?: string;
  images?: string[];
  variant_color?: string;
  variant_color_hex?: string;
  variant_size?: string;
  variant_price?: number;
  variant_stock?: number;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseNumber(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const s = String(val).trim();
  if (!s) return undefined;
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function parseInteger(val: unknown): number | undefined {
  const n = parseNumber(val);
  if (n === undefined) return undefined;
  const i = Math.floor(n);
  return Number.isFinite(i) ? i : undefined;
}

export interface ParseResult {
  rows: ParsedProductRow[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export function parseCSV(
  csvRaw: string,
  imageKeys: Set<string>
): ParseResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const parsed = Papa.parse<string[]>(csvRaw, { skipEmptyLines: true });

  if (!parsed.data?.length) {
    return {
      rows: [],
      errors: [{ row: 0, field: 'csv', message: 'CSV file is empty or contains only headers.' }],
      warnings,
    };
  }

  const rawRows = parsed.data as string[][];
  const headerRow = rawRows[0];
  const headers = headerRow.map(normalizeHeader);
  const colIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    colIndex[h] = i;
  });

  for (const col of REQUIRED_COLUMNS) {
    if (!(col in colIndex)) {
      return {
        rows: [],
        errors: [{ row: 1, field: col, message: `Missing required column: ${col}` }],
        warnings,
      };
    }
  }

  const get = (row: string[], key: string): string => {
    const i = colIndex[key];
    if (i === undefined) return '';
    const v = row[i];
    return v != null ? String(v).trim() : '';
  };

  const rows: ParsedProductRow[] = [];
  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const rowNum = r + 1;
    const name = get(row, 'name');
    const priceRaw = get(row, 'price');
    const price = parseNumber(priceRaw);
    const compareAtPrice = parseNumber(get(row, 'compare_at_price'));
    const quantity = parseInteger(get(row, 'quantity'));
    const moq = parseInteger(get(row, 'moq'));
    const statusRaw = get(row, 'status').toLowerCase();
    const featuredRaw = get(row, 'featured').toLowerCase();
    const lowStockRaw = parseInteger(get(row, 'low_stock_threshold'));
    const imagesRaw = get(row, 'images');
    const category = get(row, 'category') || undefined;
    const variantColorHex = get(row, 'variant_color_hex');
    const variantStock = parseInteger(get(row, 'variant_stock'));

    if (!name) {
      errors.push({ row: rowNum, field: 'name', message: 'Name is required' });
    }
    if (price === undefined || price < 0) {
      errors.push({ row: rowNum, field: 'price', message: 'Price must be a valid positive number' });
    }
    let compareAtPriceFinal = compareAtPrice;
    if (compareAtPrice !== undefined && (price === undefined || compareAtPrice <= price)) {
      errors.push({
        row: rowNum,
        field: 'compare_at_price',
        message: 'Compare at price must be higher than price',
      });
      compareAtPriceFinal = undefined;
    }
    if (quantity !== undefined && quantity < 0) {
      errors.push({ row: rowNum, field: 'quantity', message: 'Quantity must be a non-negative integer' });
    }
    if (moq !== undefined && (moq < 1 || !Number.isInteger(moq))) {
      errors.push({ row: rowNum, field: 'moq', message: 'MOQ must be a positive integer (>= 1)' });
    }
    if (statusRaw && !STATUS_VALUES_CSV.includes(statusRaw as StatusValue)) {
      errors.push({
        row: rowNum,
        field: 'status',
        message: `Status must be one of: Active, Draft, Archived`,
      });
    }
    if (featuredRaw && featuredRaw !== 'true' && featuredRaw !== 'false' && featuredRaw !== '1' && featuredRaw !== '0' && featuredRaw !== 'yes' && featuredRaw !== 'no') {
      errors.push({ row: rowNum, field: 'featured', message: 'Featured must be true or false' });
    }
    if (lowStockRaw !== undefined && lowStockRaw < 0) {
      errors.push({
        row: rowNum,
        field: 'low_stock_threshold',
        message: 'Low stock threshold must be a non-negative integer',
      });
    }
    if (variantColorHex && !HEX_REGEX.test(variantColorHex)) {
      errors.push({
        row: rowNum,
        field: 'variant_color_hex',
        message: 'Variant color hex must be a valid hex color (e.g. #000000)',
      });
    }
    if (variantStock !== undefined && variantStock < 0) {
      errors.push({
        row: rowNum,
        field: 'variant_stock',
        message: 'Variant stock must be a non-negative integer',
      });
    }

    const imageFilenames = imagesRaw
      ? imagesRaw.split(';').map((s) => s.trim()).filter(Boolean)
      : [];
    for (const f of imageFilenames) {
      const key = f.toLowerCase().trim();
      if (!imageKeys.has(key)) {
        errors.push({ row: rowNum, field: 'images', message: `Image '${f}' not found in archive` });
      }
    }

    const status: StatusValue =
      statusRaw && STATUS_VALUES_CSV.includes(statusRaw as StatusValue)
        ? (statusRaw as StatusValue)
        : 'draft';
    const featured =
      featuredRaw === 'true' || featuredRaw === '1' || featuredRaw === 'yes';

    const keywordsRaw = get(row, 'keywords');
    const tags = keywordsRaw
      ? keywordsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const descriptionRaw = get(row, 'description');
    const description =
      descriptionRaw && descriptionRaw.length > 500
        ? descriptionRaw.slice(0, 500)
        : descriptionRaw || undefined;

    rows.push({
      rowIndex: rowNum,
      name,
      price: price ?? 0,
      description,
      category,
      compare_at_price: compareAtPriceFinal ?? undefined,
      quantity: quantity ?? 0,
      moq: moq ?? 1,
      status,
      featured,
      seo_title: get(row, 'seo_title') || undefined,
      seo_description: get(row, 'seo_description') || undefined,
      tags,
      low_stock_threshold: lowStockRaw ?? undefined,
      preorder_shipping: get(row, 'preorder_shipping') || undefined,
      images: imageFilenames.length ? imageFilenames : undefined,
      variant_color: get(row, 'variant_color') || undefined,
      variant_color_hex: get(row, 'variant_color_hex') || undefined,
      variant_size: get(row, 'variant_size') || undefined,
      variant_price: parseNumber(get(row, 'variant_price')),
      variant_stock: variantStock ?? undefined,
    });
  }

  return { rows, errors, warnings };
}
