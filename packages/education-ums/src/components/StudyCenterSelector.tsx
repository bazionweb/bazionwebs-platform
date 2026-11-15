import { useEffect, useState } from 'react';
import { getAllStudyCenters, StudyCenter } from '../services/studyCenterService';

interface StudyCenterSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  includeAll?: boolean;
  required?: boolean;
  label?: string;
}

export function StudyCenterSelector({ 
  value, 
  onChange, 
  className = "",
  placeholder = "Select Study Center",
  includeAll = false,
  required = false,
  label
}: StudyCenterSelectorProps) {
  const [studyCenters, setStudyCenters] = useState<StudyCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadStudyCenters() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAllStudyCenters();
        if (mounted) {
          setStudyCenters(data);
        }
      } catch (error: unknown) {
        if (mounted) {
          setError(error instanceof Error ? error.message : 'Failed to load study centers');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadStudyCenters();

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <div className={`text-sm text-red-500 p-2 border border-red-200 rounded-md bg-red-50 ${className}`}>
        Failed to load study centers
      </div>
    );
  }

  const selectElement = (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      required={required}
      className={`px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-bold uppercase outline-none cursor-pointer dark:text-white ${className}`}
    >
      <option value="" disabled={!includeAll && required}>
        {loading ? "Loading..." : placeholder}
      </option>
      {includeAll && (
        <option value="All Study Centers">All Study Centers</option>
      )}
      {studyCenters.map((center) => (
        <option key={center.id} value={center.id}>
          {center.name}
        </option>
      ))}
    </select>
  );

  if (label) {
    return (
      <div className="flex flex-col gap-1 w-full">
        <label className="text-[9px] font-bold uppercase text-gray-500 tracking-widest">
          {label}
        </label>
        {selectElement}
      </div>
    );
  }

  return selectElement;
}









