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
        <span className="text-green-400">&#10003;</span> Sent: {progress.sent}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-red-400">&#10007;</span> Failed: {progress.failed}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-yellow-400">&#9203;</span> Pending: {progress.pending}
      </div>
      {progress.pending > 0 && (
        <div className="text-gray-400">ETA: ~{etaSec}s</div>
      )}
    </div>
  );
}
