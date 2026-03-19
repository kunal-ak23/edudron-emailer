import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import * as fs from 'node:fs';
import { initAuth, login, logout, getStatus } from './auth';
import { selectCsvFile, parseCsv } from './csv';
import { startSending, pauseSending, resumeSending, cancelSending, getSendLog } from './queue';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
}

app.whenReady().then(async () => {
  await initAuth();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Auth IPC
ipcMain.handle('auth:login', async () => login());
ipcMain.handle('auth:logout', async () => logout());
ipcMain.handle('auth:status', async () => getStatus());

// CSV IPC
ipcMain.handle('csv:select-file', async () => selectCsvFile());
ipcMain.handle('csv:parse', async (_event, filePath: string) => parseCsv(filePath));

// Send IPC
ipcMain.handle('send:start', async (_event, rows, delayMs) => startSending(rows, delayMs));
ipcMain.handle('send:pause', async () => pauseSending());
ipcMain.handle('send:resume', async () => resumeSending());
ipcMain.handle('send:cancel', async () => cancelSending());
ipcMain.handle('send:export-log', async () => {
  const log = getSendLog();
  if (log.length === 0) return null;
  const result = await dialog.showSaveDialog({
    defaultPath: `send_log_${new Date().toISOString().replace(/[:.]/g, '')}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const header = 'timestamp,to,subject,status,error';
  const csvRows = log.map(l =>
    `"${l.timestamp}","${l.to}","${l.subject}","${l.status}","${l.error.replace(/"/g, '""')}"`
  );
  fs.writeFileSync(result.filePath, [header, ...csvRows].join('\n'), 'utf-8');
  return result.filePath;
});
