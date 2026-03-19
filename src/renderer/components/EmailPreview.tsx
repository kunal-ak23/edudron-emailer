import { useState } from 'react';
import type { EmailRow } from '../../shared/ipc-types';

const PRESETS = [
  { label: 'Mobile', width: 375 },
  { label: 'Tablet', width: 768 },
  { label: 'Desktop', width: 0 },
] as const;

interface EmailPreviewProps {
  row: EmailRow | null;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  fromEmail: string;
}

export default function EmailPreview({ row, index, total, onPrev, onNext, fromEmail }: EmailPreviewProps) {
  const [previewWidth, setPreviewWidth] = useState(0); // 0 = full width

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
      {/* Device width presets */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => setPreviewWidth(p.width)}
            className={`px-3 py-1 text-xs rounded ${
              previewWidth === p.width
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {p.label}{p.width > 0 ? ` (${p.width}px)` : ''}
          </button>
        ))}
        {previewWidth > 0 && (
          <span className="text-xs text-gray-500 ml-auto">{previewWidth}px wide</span>
        )}
      </div>
      <div className="flex-1 overflow-auto bg-gray-600 flex justify-center">
        <iframe
          srcDoc={row.htmlBody}
          sandbox=""
          className="h-full border-0 bg-white transition-all duration-200"
          style={{ width: previewWidth > 0 ? `${previewWidth}px` : '100%' }}
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
