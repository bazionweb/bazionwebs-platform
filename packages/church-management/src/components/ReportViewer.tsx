import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeftIcon, ChevronDownIcon } from './Icons';

interface ReportViewerProps {
  title: string;
  columns: { Header: string; accessor: string; Cell?: (props: { value: unknown }) => React.ReactElement }[];
  data: unknown[];
  onBack: () => void;
}

const ReportViewer: React.FC<ReportViewerProps> = ({ title, columns, data, onBack }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copyText, setCopyText] = useState('Copy to Clipboard');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrint = () => {
    window.print();
    setIsDropdownOpen(false);
  };

  const handleCopy = () => {
    const headers = columns.map((c) => c.Header).join('\t');
    const rows = (data as Record<string, unknown>[])
      .map((row) => columns.map((col) => String(row[col.accessor] ?? '')).join('\t'))
      .join('\n');

    const tsv = `${headers}\n${rows}`;

    navigator.clipboard.writeText(tsv).then(
      () => {
        setCopyText('Copied!');
        setTimeout(() => {
          setCopyText('Copy to Clipboard');
          setIsDropdownOpen(false);
        }, 2000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
        alert('Failed to copy data.');
      },
    );
  };

  return (
    <div className="space-y-6">
      <style>
        {`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #print-section, #print-section * {
                            visibility: visible;
                        }
                        #print-section {
                            position: static !important;
                            box-shadow: none !important;
                            border: none !important;
                            margin: 0;
                            padding: 1in;
                            font-size: 10pt;
                        }
                        #print-section h2 {
                            font-size: 16pt;
                            margin-bottom: 20px;
                        }
                        #print-section table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        #print-section th, #print-section td {
                            border: 1px solid #ddd;
                            padding: 6px;
                        }
                        #print-section th {
                            background-color: #f2f2f2;
                        }
                        #print-section tr {
                            page-break-inside: avoid;
                        }
                        .no-print {
                            display: none !important;
                        }
                    }
                `}
      </style>
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Report Results</h1>
          <p className="mt-1 text-gray-600">{title}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back
          </button>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center"
            >
              Actions
              <ChevronDownIcon className="w-4 h-4 ml-2" />
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                <ul className="py-1">
                  <li>
                    <button
                      onClick={handleCopy}
                      className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {copyText}
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={handlePrint}
                      className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Print / Save as PDF
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div id="print-section" className="bg-white rounded-lg shadow-sm overflow-hidden border">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
          <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString()}</p>
          <p className="text-sm text-gray-500">Total Records: {data.length}</p>
        </div>
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm text-left text-gray-600 relative">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                {columns.map((col) => (
                  <th key={col.accessor} scope="col" className="px-6 py-3 bg-gray-50">
                    {col.Header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data as Record<string, unknown>[]).map((row, rowIndex) => (
                <tr key={rowIndex} className="bg-white border-b hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.accessor} className="px-6 py-4">
                      {row[col.accessor] as React.ReactNode}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && <p className="text-center p-8 text-gray-500">No data found for this report.</p>}
        </div>
      </div>
    </div>
  );
};

export default ReportViewer;
