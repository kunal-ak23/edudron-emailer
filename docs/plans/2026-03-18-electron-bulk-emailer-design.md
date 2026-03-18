# Edudron Bulk Emailer — Electron App Design

**Date:** 2026-03-18
**Status:** Approved

## Context

Currently, bulk emails are sent via a PowerShell script (`Send-MailQueue.ps1`) that uses Outlook COM on Windows. This design replaces it with a cross-platform Electron app that authenticates via Microsoft OAuth and sends emails through the Microsoft Graph API.

**Target users:** Internal team of 5-20 people.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Electron App                    │
│                                                  │
│  ┌──────────────┐    ┌────────────────────────┐  │
│  │  Main Process │    │   Renderer (React)     │  │
│  │              │    │                        │  │
│  │  - MSAL auth │◄──►│  - Login screen        │  │
│  │  - Graph API │    │  - CSV upload          │  │
│  │  - CSV parse │    │  - Email preview       │  │
│  │  - Send queue│    │  - Send dashboard      │  │
│  │  - Logging   │    │  - Send log/history    │  │
│  └──────────────┘    └────────────────────────┘  │
│         │                                        │
│         ▼                                        │
│  Microsoft Graph API                             │
│  POST /me/sendMail                               │
└─────────────────────────────────────────────────┘
```

- **Main process** handles all auth and API calls (tokens never touch the renderer)
- **Renderer** is a React + Tailwind SPA communicating with main via IPC
- **CSV parsing** happens in main process, rows sent to renderer for preview

## Authentication

- **Library:** `@azure/msal-node`
- **Flow:** Authorization Code with PKCE (recommended for desktop apps)
- **Scopes:** `Mail.Send`, `User.Read`
- **Token management:** MSAL's built-in cache with automatic refresh
- **Azure AD app:** Registered as "Mobile and desktop application" with redirect URI `http://localhost`
- No admin consent required for these scopes

## User Flow & Screens

### Screen 1 — Login
- "Sign in with Microsoft" button
- MSAL popup opens Microsoft login page
- After login: shows user's name + email in header with "Sign out" option

### Screen 2 — Main (3-column layout)

```
┌──────────┬──────────────────┬──────────────────┐
│  Sidebar │   CSV / Config   │  Email Preview   │
│          │                  │                  │
│ • Upload │ Recipient table: │  ┌────────────┐  │
│ • Send   │ To | Subject     │  │ From: you   │  │
│ • History│ ─────────────    │  │ To: john@.. │  │
│          │ row 1  ●         │  │ Subj: ...   │  │
│          │ row 2            │  │             │  │
│          │ row 3            │  │ [rendered   │  │
│          │ ...              │  │  HTML body] │  │
│          │                  │  │             │  │
│          │ Delay: [1200]ms  │  └────────────┘  │
│          │                  │                  │
│          │ [Send All]       │  ◄ 1/50 ►        │
└──────────┴──────────────────┴──────────────────┘
```

- **Middle panel:** Upload CSV, view recipient table, configure delay, trigger send
- **Right panel:** Sandboxed iframe rendering HTML body. Row selector to flip through emails.
- **Delay config:** Editable, defaults to 1200ms

### Screen 3 — Send Dashboard

```
┌──────────────────────────────────────────────┐
│  Sending: 23/50         [■■■■■■░░░░] 46%    │
│  ETA: ~32 seconds                            │
│                                              │
│  ✓ Sent: 20   ✗ Failed: 3   ⏳ Pending: 27  │
│                                              │
│  Per-email status table with live updates    │
│                                              │
│  [Pause]  [Cancel]  [Export Log]             │
└──────────────────────────────────────────────┘
```

- Real-time stats: sent, failed, pending + ETA
- Per-email status table with live updates
- Pause/resume and cancel controls
- Export log as CSV (same format as current script's log)

## Email Sending

- **Endpoint:** `POST https://graph.microsoft.com/v1.0/me/sendMail`
- Each email is a separate API call with configurable delay between sends
- CSV columns map directly: `To` → recipients, `Subject` → subject, `HtmlBody` → body (content type: html)
- Rate: With 1200ms delay, sends <1 req/sec — well within Graph's ~4 req/sec limit

### Error Handling
- **429 (throttled):** Respect `Retry-After` header, auto-retry
- **401 (token expired):** Auto-refresh via MSAL, retry once
- **Network errors:** Mark as failed, allow retry of failed emails after batch completes
- Per-email errors captured in log

## Tech Stack

- **Electron** (latest) + **Electron Forge** for build/packaging
- **React 18** + **Tailwind CSS** for renderer
- **Vite** as bundler (via `@electron-forge/plugin-vite`)
- **@azure/msal-node** for auth
- **@microsoft/microsoft-graph-client** for Graph API
- **papaparse** for CSV parsing
- **TypeScript** throughout

## Project Structure

```
edudron-emailer/
├── src/
│   ├── main/
│   │   ├── main.ts        # App entry, window creation
│   │   ├── auth.ts        # MSAL setup, login/logout/token
│   │   ├── graph.ts       # Graph API client, sendMail
│   │   ├── csv.ts         # CSV parsing + validation
│   │   ├── ipc.ts         # IPC handlers
│   │   └── queue.ts       # Send queue with pause/resume/cancel
│   ├── renderer/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── MainPage.tsx
│   │   │   └── SendDashboard.tsx
│   │   ├── components/
│   │   │   ├── CsvTable.tsx
│   │   │   ├── EmailPreview.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── SendStats.tsx
│   │   └── index.tsx
│   └── preload/
│       └── preload.ts     # Secure IPC bridge (contextBridge)
├── package.json
├── forge.config.ts
├── tailwind.config.js
├── tsconfig.json
└── docs/plans/
```

## IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `auth:login` | renderer→main | Trigger login |
| `auth:logout` | renderer→main | Trigger logout |
| `auth:status` | renderer→main | Get current auth state |
| `csv:parse` | renderer→main | Parse uploaded CSV file |
| `send:start` | renderer→main | Start sending queue |
| `send:pause` | renderer→main | Pause/resume queue |
| `send:cancel` | renderer→main | Cancel queue |
| `send:progress` | main→renderer | Live progress events |
| `send:export-log` | renderer→main | Export log to CSV |

## Future Enhancements (not in v1)
- Schedule sending for a later time
- Template merge fields (e.g., `{{FirstName}}`)
- Send history / past batches
