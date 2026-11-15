import { useState } from "react";
import {
  
  X,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Download,
} from '../shims/lucide-react';
import { parseV2Template, V2ImportData } from "../services/importService";
import { authFetch } from "../services/authService";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">(
    "upload",
  );
  const [, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<V2ImportData | null>(null);
  const [importResults, setImportResults] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setStep("upload");
    setFile(null);
    setParsedData(null);
    setImportResults(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setStep("importing"); // Show loading state while parsing

    try {
      const data = await parseV2Template(selectedFile);
      setParsedData(data);
      setStep("preview");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to parse file");
      setStep("upload");
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData) return;
    setStep("importing");
    setError(null);

    try {
      // POST to backend
      const response = await authFetch("/api/v1/import/v2", {
        method: "POST",
        body: JSON.stringify(parsedData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");

      setImportResults(data.results);
      setStep("done");
      if (onSuccess) onSuccess();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Import failed");
      setStep("preview");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-none shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex flex-col">
            <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-widest">
              Import System Data
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">
              V2 Relational Architecture
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
              <AlertTriangle
                className="text-red-500 shrink-0 mt-0.5"
                size={16}
              />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {step === "upload" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-blue-800 dark:text-blue-400">
                    Download Master Template
                  </h4>
                  <p className="text-[11px] text-blue-600 dark:text-blue-300 mt-1">
                    Ensure your data matches the exact V2 column structure.
                  </p>
                </div>
                <a
                  href="/UMS_Import_Template_BMI_V2.xlsx"
                  download
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest transition-colors"
                >
                  <Download size={14} /> Download
                </a>
              </div>

              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files[0])
                    handleFile(e.dataTransfer.files[0]);
                }}
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                <FileSpreadsheet
                  className="mx-auto text-gray-400 mb-4"
                  size={48}
                />
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Drag & Drop your .xlsx file here
                </p>
                <p className="text-xs text-gray-500 mt-2">or click to browse</p>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".xlsx, .xls"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFile(e.target.files[0]);
                  }}
                />
              </div>
            </div>
          )}

          {step === "preview" && parsedData && (
            <div className="space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">
                Data Preview
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(parsedData).map(([key, dataArray]) => (
                  <div
                    key={key}
                    className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                  >
                    <span className="block text-[10px] uppercase font-black tracking-widest text-gray-500">
                      {key}
                    </span>
                    <span className="block text-2xl font-black text-gray-900 dark:text-white mt-1">
                      {Array.isArray(dataArray) ? dataArray.length : 0}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setStep("upload")}
                  className="px-6 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-colors"
                >
                  Confirm & Sync to Database
                </button>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="py-12 text-center space-y-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black dark:border-white"></div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-600 dark:text-gray-400">
                Processing Import...
              </p>
            </div>
          )}

          {step === "done" && !!importResults && (
            <div className="space-y-6 text-center py-8">
              <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
              <h3 className="text-xl font-black uppercase tracking-widest text-gray-900 dark:text-white">
                Import Successful
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-4 inline-block text-left">
                <ul className="space-y-1">
                  {Object.entries(importResults as Record<string, any>).map(([key, count]) => (
                    <li
                      key={key}
                      className="flex justify-between gap-8 border-b border-gray-200 dark:border-gray-700 pb-1"
                    >
                      <span className="text-xs uppercase font-bold text-gray-500">
                        {key}
                      </span>
                      <span className="font-black text-gray-900 dark:text-white">
                        {count as number} Added
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-6">
                <button
                  onClick={handleClose}
                  className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-colors"
                >
                  Close Window
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportModal;









