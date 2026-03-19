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
