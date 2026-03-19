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
          &larr; Prev
        </button>
        <span className="text-sm text-gray-400">{index + 1} / {total}</span>
        <button onClick={onNext} disabled={index === total - 1} className="px-2 py-1 text-sm disabled:text-gray-600 hover:text-white">
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
