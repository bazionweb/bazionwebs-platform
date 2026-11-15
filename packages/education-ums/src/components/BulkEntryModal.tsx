import React, { useState } from 'react';
import { X } from '../shims/lucide-react';

export type BulkEntity = 'students' | 'grades' | 'transactions' | 'courses';

interface BulkEntryModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  entity: BulkEntity;
  /** One JSON object per line */
  sampleLine: string;
  onSubmit: (lines: string[]) => Promise<{ ok: boolean; message: string }>;
}

const hints: Record<BulkEntity, string> = {
  students:
    'Each line: JSON with first_name, last_name, gender, program_code (record id), admission_date, status, optional email/phone/student_number.',
  grades:
    'Each line: {"studentId":"...","courseCode":"CS101","academicYear":"2024-2025","semester":"Fall","percentage":88}',
  transactions:
    'Each line: {"ref":"TX-1","name":"Jane","desc":"Tuition","amt":1500,"status":"Paid","date":"2025-01-01","studentId":"optional-id"}',
  courses:
    'Each line: {"name":"...","code":"...","faculty":"...","department":"...","level":"Undergraduate","credits":3,"status":"Published","description":"...","syllabus":"..."}',
};

export const BulkEntryModal: React.FC<BulkEntryModalProps> = ({
  open,
  onClose,
  title,
  entity,
  sampleLine,
  onSubmit,
}) => {
  const [text, setText] = useState(sampleLine + '\n');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (!open) return null;

  const handleRun = async (e: React.MouseEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    try {
      const r = await onSubmit(lines);
      setMsg(r.message);
      if (r.ok) setText(sampleLine + '\n');
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Batch failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-black text-sm uppercase tracking-widest text-[#4B0082]">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-2 text-[11px] text-gray-500">{hints[entity]}</div>
        <textarea
          className="flex-1 min-h-[220px] font-mono text-xs p-3 mx-4 mb-2 border rounded-xl dark:bg-black/40 dark:border-gray-700"
          value={text}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
          spellCheck={false}
        />
        {msg && <div className="px-4 pb-2 text-xs font-bold text-gray-700 dark:text-gray-200">{msg}</div>}
        <div className="px-4 py-3 flex gap-2 justify-end border-t border-gray-100 dark:border-gray-800">
          <button type="button" className="px-4 py-2 text-xs font-bold uppercase" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            className="px-5 py-2 text-xs font-black uppercase bg-[#4B0082] text-[#FFD700] rounded-lg disabled:opacity-50"
            onClick={handleRun}
          >
            {busy ? 'Running…' : 'Run batch'}
          </button>
        </div>
      </div>
    </div>
  );
};









