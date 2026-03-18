# Edudron Bulk Emailer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an Electron desktop app that authenticates via Microsoft OAuth and sends bulk emails through Microsoft Graph API, replacing the existing PowerShell script.

**Architecture:** Electron main process handles MSAL auth, Graph API calls, CSV parsing, and send queue. React renderer provides login, CSV upload, email preview, and real-time send dashboard. Communication via typed IPC channels with contextBridge preload.

**Tech Stack:** Electron Forge + Vite, React 18, Tailwind CSS v4, TypeScript, @azure/msal-node, @microsoft/microsoft-graph-client, papaparse

**Design doc:** `docs/plans/2026-03-18-electron-bulk-emailer-design.md`

---

## Task 1: Scaffold Electron + React + Tailwind Project

**Files:**
- Create: `package.json`, `forge.config.ts`, `tsconfig.json`
- Create: `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`
- Create: `src/main/main.ts`, `src/preload/preload.ts`, `src/renderer/index.tsx`, `src/renderer/index.css`
- Create: `index.html`

**Step 1: Scaffold with Electron Forge Vite-TypeScript template**

```bash
cd /Users/kunalsharma/datagami
npx create-electron-app@latest edudron-emailer-app --template=vite-typescript
```

**Step 2: Move into the project and install React + Tailwind**

```bash
cd edudron-emailer-app
npm install react react-dom
npm install --save-dev @types/react @types/react-dom @vitejs/plugin-react
npm install tailwindcss @tailwindcss/vite
```

**Step 3: Install project dependencies**

```bash
npm install @azure/msal-node @azure/msal-node-extensions @microsoft/microsoft-graph-client isomorphic-fetch papaparse
npm install --save-dev @types/papaparse
```

**Step 4: Configure vite.renderer.config.ts for React + Tailwind**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
});
```

**Step 5: Add JSX support to tsconfig.json**

Add `"jsx": "react-jsx"` to `compilerOptions`.

**Step 6: Create renderer entry point**

Create `src/renderer/index.css`:
```css
@import "tailwindcss";
```

Create `src/renderer/index.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

Create `src/renderer/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <h1 className="text-4xl font-bold text-white">Edudron Emailer</h1>
    </div>
  );
}
```

**Step 7: Update main.ts to load renderer**

Update `src/main/main.ts` (moved from `src/main.ts`):
```typescript
import { app, BrowserWindow } from 'electron';
import path from 'node:path';

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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
```

**Step 8: Update forge.config.ts entry paths**

Ensure the `build` entries point to `src/main/main.ts` and `src/preload/preload.ts`.

**Step 9: Verify it runs**

```bash
npm start
```

Expected: Electron window opens showing "Edudron Emailer" centered in dark background.

**Step 10: Commit**

```bash
git init && git add -A
git commit -m "feat: scaffold Electron + React + Tailwind project"
```

---

## Task 2: Set Up Preload Bridge & IPC Types

**Files:**
- Create: `src/preload/preload.ts`
- Create: `src/shared/ipc-types.ts`
- Create: `src/renderer/electron.d.ts`

**Step 1: Define shared IPC types**

Create `src/shared/ipc-types.ts`:
```typescript
export interface EmailRow {
  to: string;
  subject: string;
  htmlBody: string;
}

export interface UserProfile {
  displayName: string;
  email: string;
}

export interface SendProgress {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  currentEmail: string;
  errors: Array<{ to: string; error: string }>;
}

export type SendStatus = 'idle' | 'sending' | 'paused' | 'cancelled' | 'done';

export interface IElectronAPI {
  auth: {
    login: () => Promise<UserProfile>;
    logout: () => Promise<void>;
    getStatus: () => Promise<UserProfile | null>;
  };
  csv: {
    parse: (filePath: string) => Promise<EmailRow[]>;
    selectFile: () => Promise<string | null>;
  };
  send: {
    start: (rows: EmailRow[], delayMs: number) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    cancel: () => Promise<void>;
    onProgress: (callback: (progress: SendProgress) => void) => () => void;
    onStatusChange: (callback: (status: SendStatus) => void) => () => void;
    exportLog: () => Promise<string | null>;
  };
}
```

**Step 2: Create preload script**

Create `src/preload/preload.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron';
import type { IElectronAPI, SendProgress, SendStatus } from '../shared/ipc-types';

const api: IElectronAPI = {
  auth: {
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getStatus: () => ipcRenderer.invoke('auth:status'),
  },
  csv: {
    parse: (filePath: string) => ipcRenderer.invoke('csv:parse', filePath),
    selectFile: () => ipcRenderer.invoke('csv:select-file'),
  },
  send: {
    start: (rows, delayMs) => ipcRenderer.invoke('send:start', rows, delayMs),
    pause: () => ipcRenderer.invoke('send:pause'),
    resume: () => ipcRenderer.invoke('send:resume'),
    cancel: () => ipcRenderer.invoke('send:cancel'),
    onProgress: (callback: (progress: SendProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: SendProgress) => callback(progress);
      ipcRenderer.on('send:progress', handler);
      return () => ipcRenderer.removeListener('send:progress', handler);
    },
    onStatusChange: (callback: (status: SendStatus) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: SendStatus) => callback(status);
      ipcRenderer.on('send:status', handler);
      return () => ipcRenderer.removeListener('send:status', handler);
    },
    exportLog: () => ipcRenderer.invoke('send:export-log'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
```

**Step 3: Add TypeScript declaration for renderer**

Create `src/renderer/electron.d.ts`:
```typescript
import type { IElectronAPI } from '../shared/ipc-types';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
```

**Step 4: Verify it compiles**

```bash
npm start
```

Expected: App runs without errors. `window.electronAPI` available in renderer console.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add preload bridge with typed IPC channels"
```

---

## Task 3: MSAL Authentication

**Files:**
- Create: `src/main/auth.ts`
- Create: `src/main/auth-config.ts`
- Modify: `src/main/main.ts` — register auth IPC handlers

**Step 1: Create auth config**

Create `src/main/auth-config.ts`:
```typescript
export const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || 'YOUR_CLIENT_ID',
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'organizations'}`,
  },
};

export const graphScopes = ['User.Read', 'Mail.Send'];
```

**Step 2: Create auth provider**

Create `src/main/auth.ts`:
```typescript
import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AuthenticationResult,
  type AccountInfo,
} from '@azure/msal-node';
import { shell } from 'electron';
import { msalConfig, graphScopes } from './auth-config';
import type { UserProfile } from '../shared/ipc-types';

let pca: PublicClientApplication;
let currentAccount: AccountInfo | null = null;

export async function initAuth(): Promise<void> {
  pca = new PublicClientApplication({ auth: msalConfig.auth });
  // Check for cached accounts
  const accounts = await pca.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    currentAccount = accounts[0];
  }
}

export async function login(): Promise<UserProfile> {
  const authResult = await pca.acquireTokenInteractive({
    scopes: graphScopes,
    openBrowser: async (url) => { await shell.openExternal(url); },
    successTemplate: '<h1>Signed in! You can close this window.</h1>',
    errorTemplate: '<h1>Sign-in failed. Check the app for details.</h1>',
  });
  currentAccount = authResult.account;
  return {
    displayName: authResult.account.name || authResult.account.username,
    email: authResult.account.username,
  };
}

export async function logout(): Promise<void> {
  if (currentAccount) {
    await pca.getTokenCache().removeAccount(currentAccount);
    currentAccount = null;
  }
}

export async function getAccessToken(): Promise<string> {
  if (!currentAccount) throw new Error('Not logged in');
  try {
    const result = await pca.acquireTokenSilent({
      scopes: graphScopes,
      account: currentAccount,
    });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      const result = await pca.acquireTokenInteractive({
        scopes: graphScopes,
        openBrowser: async (url) => { await shell.openExternal(url); },
      });
      currentAccount = result.account;
      return result.accessToken;
    }
    throw error;
  }
}

export function getStatus(): UserProfile | null {
  if (!currentAccount) return null;
  return {
    displayName: currentAccount.name || currentAccount.username,
    email: currentAccount.username,
  };
}
```

**Step 3: Register auth IPC handlers in main.ts**

Add to `src/main/main.ts`:
```typescript
import { ipcMain } from 'electron';
import { initAuth, login, logout, getStatus } from './auth';

app.whenReady().then(async () => {
  await initAuth();
  createWindow();
});

ipcMain.handle('auth:login', async () => login());
ipcMain.handle('auth:logout', async () => logout());
ipcMain.handle('auth:status', async () => getStatus());
```

**Step 4: Verify it compiles**

```bash
npm start
```

Expected: App starts without errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add MSAL authentication with login/logout/token"
```

---

## Task 4: CSV Parsing

**Files:**
- Create: `src/main/csv.ts`
- Modify: `src/main/main.ts` — register CSV IPC handlers

**Step 1: Create CSV parser**

Create `src/main/csv.ts`:
```typescript
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

  // Validate required columns
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
```

**Step 2: Register CSV IPC handlers**

Add to `src/main/main.ts`:
```typescript
import { selectCsvFile, parseCsv } from './csv';

ipcMain.handle('csv:select-file', async () => selectCsvFile());
ipcMain.handle('csv:parse', async (_event, filePath: string) => parseCsv(filePath));
```

**Step 3: Verify it compiles**

```bash
npm start
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add CSV file selection and parsing with validation"
```

---

## Task 5: Graph API Email Sender

**Files:**
- Create: `src/main/graph.ts`

**Step 1: Create Graph email sender**

Create `src/main/graph.ts`:
```typescript
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import { getAccessToken } from './auth';

function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const token = await getAccessToken();
  const client = getGraphClient(token);

  const message = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: htmlBody,
      },
      toRecipients: [
        { emailAddress: { address: to } },
      ],
    },
    saveToSentItems: true,
  };

  await client.api('/me/sendMail').post(message);
}

export async function getUserProfile(): Promise<{ displayName: string; mail: string }> {
  const token = await getAccessToken();
  const client = getGraphClient(token);
  const profile = await client.api('/me').select('displayName,mail,userPrincipalName').get();
  return {
    displayName: profile.displayName,
    mail: profile.mail || profile.userPrincipalName,
  };
}
```

**Step 2: Verify it compiles**

```bash
npm start
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Microsoft Graph sendMail and user profile"
```

---

## Task 6: Send Queue with Pause/Resume/Cancel

**Files:**
- Create: `src/main/queue.ts`
- Modify: `src/main/main.ts` — register send IPC handlers

**Step 1: Create the send queue**

Create `src/main/queue.ts`:
```typescript
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
      pending: rows.length - sent - failed - (isCancelled ? 0 : 0),
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

export function getStatus(): SendStatus {
  return status;
}
```

**Step 2: Register send IPC handlers**

Add to `src/main/main.ts`:
```typescript
import { startSending, pauseSending, resumeSending, cancelSending, getSendLog } from './queue';
import { dialog } from 'electron';
import * as fs from 'node:fs';

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
  const rows = log.map(l =>
    `"${l.timestamp}","${l.to}","${l.subject}","${l.status}","${l.error.replace(/"/g, '""')}"`
  );
  fs.writeFileSync(result.filePath, [header, ...rows].join('\n'), 'utf-8');
  return result.filePath;
});
```

**Step 3: Verify it compiles**

```bash
npm start
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add send queue with pause/resume/cancel and log export"
```

---

## Task 7: Login Page UI

**Files:**
- Create: `src/renderer/pages/LoginPage.tsx`
- Modify: `src/renderer/App.tsx` — add routing

**Step 1: Create LoginPage**

Create `src/renderer/pages/LoginPage.tsx`:
```tsx
import { useState } from 'react';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.auth.login();
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-2">Edudron Emailer</h1>
      <p className="text-gray-400 mb-8">Bulk email sender for your team</p>
      <button
        onClick={handleLogin}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded-lg text-lg font-medium transition-colors"
      >
        {loading ? 'Signing in...' : 'Sign in with Microsoft'}
      </button>
      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </div>
  );
}
```

**Step 2: Update App.tsx with auth state routing**

```tsx
import { useState, useEffect } from 'react';
import type { UserProfile } from '../shared/ipc-types';
import LoginPage from './pages/LoginPage';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    window.electronAPI.auth.getStatus().then(profile => {
      setUser(profile);
      setChecking(false);
    });
  }, []);

  const handleLogin = async () => {
    const profile = await window.electronAPI.auth.getStatus();
    setUser(profile);
  };

  const handleLogout = async () => {
    await window.electronAPI.auth.logout();
    setUser(null);
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen bg-gray-900 text-white">
      <header className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <h1 className="text-lg font-semibold">Edudron Emailer</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300">{user.displayName} ({user.email})</span>
          <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300">
            Sign out
          </button>
        </div>
      </header>
      <main className="p-6">
        {/* MainPage will go here in Task 8 */}
        <p className="text-gray-400">Logged in. Main page coming next.</p>
      </main>
    </div>
  );
}
```

**Step 3: Verify it runs**

```bash
npm start
```

Expected: Login page shows. Clicking "Sign in with Microsoft" triggers MSAL popup (will fail without real Azure AD config, but UI should work).

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add login page with Microsoft OAuth flow"
```

---

## Task 8: Main Page — CSV Upload + Email Preview

**Files:**
- Create: `src/renderer/pages/MainPage.tsx`
- Create: `src/renderer/components/CsvTable.tsx`
- Create: `src/renderer/components/EmailPreview.tsx`
- Modify: `src/renderer/App.tsx` — render MainPage

**Step 1: Create CsvTable component**

Create `src/renderer/components/CsvTable.tsx`:
```tsx
import type { EmailRow } from '../../shared/ipc-types';

interface CsvTableProps {
  rows: EmailRow[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function CsvTable({ rows, selectedIndex, onSelect }: CsvTableProps) {
  return (
    <div className="overflow-auto max-h-[calc(100vh-220px)]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-800">
          <tr>
            <th className="text-left px-3 py-2 text-gray-400 font-medium">#</th>
            <th className="text-left px-3 py-2 text-gray-400 font-medium">To</th>
            <th className="text-left px-3 py-2 text-gray-400 font-medium">Subject</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={() => onSelect(i)}
              className={`cursor-pointer border-b border-gray-700 hover:bg-gray-700 ${
                i === selectedIndex ? 'bg-blue-900/40' : ''
              }`}
            >
              <td className="px-3 py-2 text-gray-500">{i + 1}</td>
              <td className="px-3 py-2 truncate max-w-[200px]">{row.to}</td>
              <td className="px-3 py-2 truncate max-w-[250px]">{row.subject}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Create EmailPreview component**

Create `src/renderer/components/EmailPreview.tsx`:
```tsx
import type { EmailRow } from '../../shared/ipc-types';

interface EmailPreviewProps {
  row: EmailRow | null;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  fromEmail: string;
}

export default function EmailPreview({ row, index, total, onPrev, onNext, fromEmail }: EmailPreviewProps) {
  if (!row) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Upload a CSV to preview emails
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-700 space-y-1">
        <div className="text-sm"><span className="text-gray-400">From:</span> {fromEmail}</div>
        <div className="text-sm"><span className="text-gray-400">To:</span> {row.to}</div>
        <div className="text-sm"><span className="text-gray-400">Subject:</span> {row.subject}</div>
      </div>
      <div className="flex-1 overflow-auto bg-white">
        <iframe
          srcDoc={row.htmlBody}
          sandbox=""
          className="w-full h-full border-0"
          title="Email preview"
        />
      </div>
      <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-gray-700">
        <button onClick={onPrev} disabled={index === 0} className="px-2 py-1 text-sm disabled:text-gray-600 hover:text-white">
          ← Prev
        </button>
        <span className="text-sm text-gray-400">{index + 1} / {total}</span>
        <button onClick={onNext} disabled={index === total - 1} className="px-2 py-1 text-sm disabled:text-gray-600 hover:text-white">
          Next →
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Create MainPage**

Create `src/renderer/pages/MainPage.tsx`:
```tsx
import { useState } from 'react';
import type { EmailRow, UserProfile } from '../../shared/ipc-types';
import CsvTable from '../components/CsvTable';
import EmailPreview from '../components/EmailPreview';

interface MainPageProps {
  user: UserProfile;
  onStartSend: (rows: EmailRow[], delayMs: number) => void;
}

export default function MainPage({ user, onStartSend }: MainPageProps) {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [delayMs, setDelayMs] = useState(1200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    setLoading(true);
    setError(null);
    try {
      const filePath = await window.electronAPI.csv.selectFile();
      if (!filePath) { setLoading(false); return; }
      const parsed = await window.electronAPI.csv.parse(filePath);
      setRows(parsed);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Sidebar */}
      <div className="w-48 border-r border-gray-700 p-4 flex flex-col gap-3">
        <button
          onClick={handleUpload}
          disabled={loading}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium"
        >
          {loading ? 'Loading...' : 'Upload CSV'}
        </button>
        {rows.length > 0 && (
          <>
            <div className="text-sm text-gray-400">{rows.length} emails loaded</div>
            <div className="mt-2">
              <label className="text-xs text-gray-400 block mb-1">Delay (ms)</label>
              <input
                type="number"
                value={delayMs}
                onChange={e => setDelayMs(Number(e.target.value))}
                min={0}
                className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm"
              />
            </div>
            <button
              onClick={() => onStartSend(rows, delayMs)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium mt-auto"
            >
              Send All
            </button>
          </>
        )}
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      {/* CSV Table */}
      <div className="flex-1 border-r border-gray-700">
        {rows.length > 0 ? (
          <CsvTable rows={rows} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Upload a CSV file to get started
          </div>
        )}
      </div>

      {/* Email Preview */}
      <div className="w-[450px]">
        <EmailPreview
          row={rows[selectedIndex] || null}
          index={selectedIndex}
          total={rows.length}
          onPrev={() => setSelectedIndex(i => Math.max(0, i - 1))}
          onNext={() => setSelectedIndex(i => Math.min(rows.length - 1, i + 1))}
          fromEmail={user.email}
        />
      </div>
    </div>
  );
}
```

**Step 4: Update App.tsx to render MainPage**

Replace the placeholder in the `return` block for logged-in state with:
```tsx
import MainPage from './pages/MainPage';
// In the logged-in return:
<MainPage user={user} onStartSend={(rows, delayMs) => {/* Task 9 */}} />
```

**Step 5: Verify it runs**

```bash
npm start
```

Expected: After login, shows 3-column layout. Upload button opens file dialog. Selecting a CSV populates the table and preview.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add main page with CSV upload, recipient table, and email preview"
```

---

## Task 9: Send Dashboard UI

**Files:**
- Create: `src/renderer/pages/SendDashboard.tsx`
- Create: `src/renderer/components/ProgressBar.tsx`
- Create: `src/renderer/components/SendStats.tsx`
- Modify: `src/renderer/App.tsx` — add send state management and dashboard view

**Step 1: Create ProgressBar component**

Create `src/renderer/components/ProgressBar.tsx`:
```tsx
interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span>Sending: {current}/{total}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-3">
        <div
          className="bg-blue-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

**Step 2: Create SendStats component**

Create `src/renderer/components/SendStats.tsx`:
```tsx
import type { SendProgress } from '../../shared/ipc-types';

interface SendStatsProps {
  progress: SendProgress;
  delayMs: number;
  startTime: number;
}

export default function SendStats({ progress, delayMs, startTime }: SendStatsProps) {
  const elapsed = Date.now() - startTime;
  const processed = progress.sent + progress.failed;
  const msPerEmail = processed > 0 ? elapsed / processed : delayMs;
  const etaMs = progress.pending * msPerEmail;
  const etaSec = Math.ceil(etaMs / 1000);

  return (
    <div className="flex gap-6 text-sm">
      <div className="flex items-center gap-1">
        <span className="text-green-400">✓</span> Sent: {progress.sent}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-red-400">✗</span> Failed: {progress.failed}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-yellow-400">⏳</span> Pending: {progress.pending}
      </div>
      {progress.pending > 0 && (
        <div className="text-gray-400">ETA: ~{etaSec}s</div>
      )}
    </div>
  );
}
```

**Step 3: Create SendDashboard page**

Create `src/renderer/pages/SendDashboard.tsx`:
```tsx
import { useState, useEffect, useRef } from 'react';
import type { SendProgress, SendStatus } from '../../shared/ipc-types';
import ProgressBar from '../components/ProgressBar';
import SendStats from '../components/SendStats';

interface SendDashboardProps {
  delayMs: number;
  onDone: () => void;
}

export default function SendDashboard({ delayMs, onDone }: SendDashboardProps) {
  const [progress, setProgress] = useState<SendProgress>({
    total: 0, sent: 0, failed: 0, pending: 0, currentEmail: '', errors: [],
  });
  const [status, setStatus] = useState<SendStatus>('sending');
  const startTime = useRef(Date.now());

  useEffect(() => {
    const unsubProgress = window.electronAPI.send.onProgress(setProgress);
    const unsubStatus = window.electronAPI.send.onStatusChange(setStatus);
    return () => { unsubProgress(); unsubStatus(); };
  }, []);

  const handlePause = () => {
    if (status === 'sending') window.electronAPI.send.pause();
    else if (status === 'paused') window.electronAPI.send.resume();
  };

  const handleCancel = async () => {
    await window.electronAPI.send.cancel();
  };

  const handleExport = async () => {
    await window.electronAPI.send.exportLog();
  };

  const isDone = status === 'done' || status === 'cancelled';

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <ProgressBar current={progress.sent + progress.failed} total={progress.total} />
      <SendStats progress={progress} delayMs={delayMs} startTime={startTime.current} />

      {/* Per-email status table */}
      {progress.errors.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-red-400 mb-2">Failed emails:</h3>
          <div className="overflow-auto max-h-40 bg-gray-800 rounded p-2">
            {progress.errors.map((e, i) => (
              <div key={i} className="text-xs text-gray-300 py-1">
                <span className="text-red-400">{e.to}</span>: {e.error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 pt-4">
        {!isDone && (
          <>
            <button
              onClick={handlePause}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
            >
              {status === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
            >
              Cancel
            </button>
          </>
        )}
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm"
        >
          Export Log
        </button>
        {isDone && (
          <button
            onClick={onDone}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Back to Upload
          </button>
        )}
      </div>

      {isDone && (
        <div className={`text-sm ${status === 'cancelled' ? 'text-yellow-400' : 'text-green-400'}`}>
          {status === 'cancelled' ? 'Sending cancelled.' : 'All emails processed!'}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Update App.tsx to toggle between MainPage and SendDashboard**

Add state management in App.tsx:
```tsx
import SendDashboard from './pages/SendDashboard';

// Add state:
const [view, setView] = useState<'main' | 'sending'>('main');
const [sendDelayMs, setSendDelayMs] = useState(1200);

// onStartSend handler:
const handleStartSend = async (rows: EmailRow[], delayMs: number) => {
  setSendDelayMs(delayMs);
  setView('sending');
  await window.electronAPI.send.start(rows, delayMs);
};

// In the logged-in return, replace <MainPage>:
{view === 'main' ? (
  <MainPage user={user} onStartSend={handleStartSend} />
) : (
  <SendDashboard delayMs={sendDelayMs} onDone={() => setView('main')} />
)}
```

**Step 5: Verify it runs**

```bash
npm start
```

Expected: After clicking "Send All", view switches to dashboard with progress bar, stats, and controls.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add send dashboard with progress, stats, pause/cancel/export"
```

---

## Task 10: Final Wiring & Polish

**Files:**
- Modify: `src/main/main.ts` — ensure all IPC handlers registered
- Create: `.env.example` — document required env vars
- Modify: `forge.config.ts` — add makers for distribution

**Step 1: Create .env.example**

Create `.env.example`:
```
AZURE_CLIENT_ID=your-app-registration-client-id
AZURE_TENANT_ID=your-azure-tenant-id-or-organizations
```

**Step 2: Consolidate main.ts imports and IPC registration**

Verify `src/main/main.ts` imports and registers all handlers from auth, csv, and queue modules. Should look like:

```typescript
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import * as fs from 'node:fs';
import { initAuth, login, logout, getStatus } from './auth';
import { selectCsvFile, parseCsv } from './csv';
import { startSending, pauseSending, resumeSending, cancelSending, getSendLog } from './queue';

// Window creation...
// Auth handlers...
// CSV handlers...
// Send handlers...
```

**Step 3: Add makers to forge.config.ts**

```typescript
makers: [
  { name: '@electron-forge/maker-zip' },
],
```

**Step 4: Build and verify**

```bash
npm run make
```

Expected: Produces a distributable zip in the `out/` directory.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add env config, consolidate main process, add build maker"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Project scaffold | package.json, forge/vite configs, basic React app |
| 2 | IPC bridge | preload.ts, ipc-types.ts, electron.d.ts |
| 3 | MSAL auth | auth.ts, auth-config.ts |
| 4 | CSV parsing | csv.ts |
| 5 | Graph API sender | graph.ts |
| 6 | Send queue | queue.ts |
| 7 | Login UI | LoginPage.tsx, App.tsx routing |
| 8 | Main page UI | MainPage.tsx, CsvTable.tsx, EmailPreview.tsx |
| 9 | Send dashboard UI | SendDashboard.tsx, ProgressBar.tsx, SendStats.tsx |
| 10 | Final wiring | main.ts consolidation, .env, build config |
