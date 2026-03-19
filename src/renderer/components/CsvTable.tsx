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
