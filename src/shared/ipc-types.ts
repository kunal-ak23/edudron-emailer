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
