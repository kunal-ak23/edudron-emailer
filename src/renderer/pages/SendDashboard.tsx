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
