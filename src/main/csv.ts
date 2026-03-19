import { dialog } from 'electron';
import * as fs from 'node:fs';
import Papa from 'papaparse';
import type { EmailRow } from '../shared/ipc-types';

export async function selectCsvFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

export function parseCsv(filePath: string): EmailRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse errors: ${parsed.errors.map(e => e.message).join(', ')}`);
  }

  const required = ['To', 'Subject', 'HtmlBody'];
  const headers = parsed.meta.fields || [];
  const missing = required.filter(col => !headers.includes(col));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`);
  }

  return parsed.data.map((row, i) => {
    if (!row.To?.trim()) throw new Error(`Row ${i + 1}: missing "To" value`);
    if (!row.Subject?.trim()) throw new Error(`Row ${i + 1}: missing "Subject" value`);
    if (!row.HtmlBody?.trim()) throw new Error(`Row ${i + 1}: missing "HtmlBody" value`);
    return {
      to: row.To.trim(),
      subject: row.Subject.trim(),
      htmlBody: row.HtmlBody.trim(),
    };
  });
}
