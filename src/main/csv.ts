import { dialog } from 'electron';
import * as fs from 'node:fs';
import Papa from 'papaparse';
import type { EmailRow } from '../shared/ipc-types';

export async function selectCsvFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'CSV/TSV Files', extensions: ['csv', 'tsv', 'txt'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

export function parseCsv(filePath: string): EmailRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');

  console.log('[CSV] File path:', filePath);
  console.log('[CSV] File size:', content.length, 'bytes');
  console.log('[CSV] First 500 chars:', content.substring(0, 500));

  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    delimiter: '', // auto-detect (handles both comma and tab-separated)
    quoteChar: '"',
  });

  console.log('[CSV] Detected delimiter:', JSON.stringify(parsed.meta.delimiter));
  console.log('[CSV] Headers:', parsed.meta.fields);
  console.log('[CSV] Row count:', parsed.data.length);
  console.log('[CSV] Errors:', JSON.stringify(parsed.errors, null, 2));
  if (parsed.data.length > 0) {
    console.log('[CSV] First row keys:', Object.keys(parsed.data[0]));
    console.log('[CSV] First row values:', JSON.stringify(parsed.data[0], null, 2));
  }

  // Filter out only fatal errors, not minor field count mismatches
  const fatalErrors = parsed.errors.filter(e => e.type === 'Quotes');
  if (fatalErrors.length > 0) {
    throw new Error(`CSV parse errors: ${fatalErrors.map(e => e.message).join(', ')}`);
  }

  const required = ['To', 'Subject', 'HtmlBody'];
  const headers = parsed.meta.fields || [];
  const missing = required.filter(col => !headers.includes(col));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}. Found columns: ${headers.join(', ')}`);
  }

  const rows: EmailRow[] = [];
  let skipped = 0;
  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    // Skip rows where all required fields are empty (trailing empty rows)
    if (!row.To?.trim() && !row.Subject?.trim() && !row.HtmlBody?.trim()) {
      skipped++;
      continue;
    }
    console.log(`[CSV] Row ${i + 1}: To="${row.To}", Subject="${row.Subject?.substring(0, 40)}...", HtmlBody=${row.HtmlBody ? row.HtmlBody.length + ' chars' : 'EMPTY'}`);
    if (!row.To?.trim()) throw new Error(`Row ${i + 1}: missing "To" value`);
    if (!row.Subject?.trim()) throw new Error(`Row ${i + 1}: missing "Subject" value`);
    if (!row.HtmlBody?.trim()) throw new Error(`Row ${i + 1}: missing "HtmlBody" value`);
    rows.push({
      to: row.To.trim(),
      subject: row.Subject.trim(),
      htmlBody: row.HtmlBody.trim(),
    });
  }
  if (skipped > 0) console.log(`[CSV] Skipped ${skipped} empty rows`);
  console.log(`[CSV] Loaded ${rows.length} valid email rows`);
  return rows;
}
