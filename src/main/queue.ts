import { BrowserWindow } from 'electron';
import { sendEmail } from './graph';
import type { EmailRow, SendProgress, SendStatus } from '../shared/ipc-types';

interface SendLog {
  timestamp: string;
  to: string;
  subject: string;
  status: 'SENT' | 'ERROR';
  error: string;
}

let status: SendStatus = 'idle';
let isPaused = false;
let isCancelled = false;
let sendLog: SendLog[] = [];

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

function emitProgress(progress: SendProgress): void {
  getMainWindow()?.webContents.send('send:progress', progress);
}

function emitStatus(newStatus: SendStatus): void {
  status = newStatus;
  getMainWindow()?.webContents.send('send:status', newStatus);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitWhilePaused(): Promise<void> {
  while (isPaused && !isCancelled) {
    await sleep(200);
  }
}

export async function startSending(rows: EmailRow[], delayMs: number): Promise<void> {
  isPaused = false;
  isCancelled = false;
  sendLog = [];
  emitStatus('sending');

  let sent = 0;
  let failed = 0;
  const errors: Array<{ to: string; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    if (isCancelled) break;
    await waitWhilePaused();
    if (isCancelled) break;

    const row = rows[i];
    const timestamp = new Date().toISOString();

    try {
      await sendEmail(row.to, row.subject, row.htmlBody);
      sent++;
      sendLog.push({ timestamp, to: row.to, subject: row.subject, status: 'SENT', error: '' });
    } catch (err) {
      failed++;
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push({ to: row.to, error: errMsg });
      sendLog.push({ timestamp, to: row.to, subject: row.subject, status: 'ERROR', error: errMsg });
    }

    emitProgress({
      total: rows.length,
      sent,
      failed,
      pending: rows.length - sent - failed,
      currentEmail: row.to,
      errors,
    });

    if (i < rows.length - 1 && !isCancelled) {
      await sleep(delayMs);
    }
  }

  emitStatus(isCancelled ? 'cancelled' : 'done');
}

export function pauseSending(): void {
  if (status === 'sending') {
    isPaused = true;
    emitStatus('paused');
  }
}

export function resumeSending(): void {
  if (status === 'paused') {
    isPaused = false;
    emitStatus('sending');
  }
}

export function cancelSending(): void {
  isCancelled = true;
  isPaused = false;
}

export function getSendLog(): SendLog[] {
  return sendLog;
}
