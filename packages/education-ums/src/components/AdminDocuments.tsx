import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  Eye,
  X,
  AlertCircle,
  UploadCloud,
  CheckCircle2,
  FolderOpen,
  ShieldCheck,
  FilePlus,
  Filter,
  ExternalLink,
} from '../shims/lucide-react';
import { listDocuments, downloadDocument, uploadDocument, updateDocumentVerification, type Document } from "../services/adminDocumentService";
import { usePagination } from "../hooks/usePagination";
import { useTranslation } from '../shims/react-i18next';
import { API_URL } from "../services/config";
import { authFetch } from "../services/authService";

const AdminDocuments: React.FC = () => {
  useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("All Types");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const { page, perPage, meta, setPage, setMeta } = usePagination(20);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [viewingDocUrl, setViewingDocUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFormData, setUploadFormData] = useState({
    file_name: "",
    first_name: "",
    last_name: "",
    user_email: "",
    doc_type: "transcript",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const params: Parameters<typeof listDocuments>[0] = {
        page,
        perPage,
      };
      if (docTypeFilter !== "All Types") params.doc_type = docTypeFilter;

      const response = await listDocuments(params);

      if (response.success && response.data) {
        setDocuments(response.data.items);
        setMeta({
          page: response.data.page,
          perPage: response.data.perPage,
          total: response.data.total,
        });
      }
    } catch (_error) {
      // Handled gracefully by service
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = useCallback(async (doc: Document) => {
    
    setIsPreviewLoading(true);
    setViewingDoc(doc);
    setViewingDocUrl(null);
    try {
      const url = `${API_URL}/documents/${doc.id}/download`;
      const response = await authFetch(url, {}, 8000);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const rawBlob = await response.blob();
      const isPdfDoc = doc.file_name.toLowerCase().endsWith('.pdf') || doc.mime_type === 'application/pdf';
      const resolvedMime = isPdfDoc ? 'application/pdf' : (doc.mime_type || rawBlob.type || 'application/octet-stream');
      const blob = rawBlob.type === resolvedMime ? rawBlob : new Blob([rawBlob], { type: resolvedMime });
      const objectUrl = URL.createObjectURL(blob);
      setViewingDocUrl(objectUrl);
    } catch {
      // No simulated placeholder is generated — if the stored file cannot be
      // fetched we surface a real "preview unavailable" state below.
      setViewingDocUrl(null);
    } finally {
      setIsPreviewLoading(false);
    }
  }, []);

  // Cleanup blob URL when modal closes
  useEffect(() => {
    return () => {
      if (viewingDocUrl && viewingDocUrl.startsWith('blob:')) {
        URL.revokeObjectURL(viewingDocUrl);
      }
    };
  }, [viewingDocUrl]);

  const closePreview = useCallback(() => {
    if (viewingDocUrl && viewingDocUrl.startsWith('blob:')) {
      URL.revokeObjectURL(viewingDocUrl);
    }
    setViewingDoc(null);
    setViewingDocUrl(null);
    
    setIsPreviewLoading(false);
  }, [viewingDocUrl]);

  useEffect(() => {
    fetchDocuments();
  }, [page, perPage, docTypeFilter]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        doc.file_name.toLowerCase().includes(searchLower) ||
        `${doc.first_name} ${doc.last_name}`.toLowerCase().includes(searchLower) ||
        doc.user_email.toLowerCase().includes(searchLower);

      const status = doc.verification_status || "verified";
      const matchesVerification = verificationFilter === "all" || status === verificationFilter;

      return matchesSearch && matchesVerification;
    });
  }, [documents, searchTerm, verificationFilter]);

  const handleDownload = async (docId: string) => {
    await downloadDocument(docId);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select the credential file to upload.");
      return;
    }
    if (!uploadFormData.file_name || !uploadFormData.first_name || !uploadFormData.user_email) {
      setUploadError("File name, first name and recipient email are required.");
      return;
    }
    setIsUploading(true);
    setUploadError("");
    try {
      const created = await uploadDocument({
        file_name: uploadFormData.file_name,
        first_name: uploadFormData.first_name,
        last_name: uploadFormData.last_name || "Applicant",
        user_email: uploadFormData.user_email,
        doc_type: uploadFormData.doc_type,
        file: selectedFile,
      });

      if (!created.success || !created.data) {
        setUploadError(created.error || "Upload failed. The student email must match a registered user with an application on record.");
        return;
      }

      setUploadSuccess(`Document ${uploadFormData.file_name} uploaded and archived!`);
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadFormData({
        file_name: "",
        first_name: "",
        last_name: "",
        user_email: "",
        doc_type: "transcript",
      });
      fetchDocuments();
      setTimeout(() => setUploadSuccess(""), 4000);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleVerificationStatus = async (doc: Document) => {
    const current = doc.verification_status || "verified";
    const next = current === "verified" ? "pending" : current === "pending" ? "flagged" : "verified";
    const result = await updateDocumentVerification(doc.id, next);
    if (result.success) {
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, verification_status: next } : d)),
      );
    } else {
      alert(result.error || "Failed to update verification status.");
    }
  };

  const handleExportCSV = () => {
    const headers = ["ID", "File Name", "Student Name", "Email", "Doc Type", "Size Bytes", "Uploaded At"];
    const rows = filteredDocuments.map(d => [
      d.id,
      `"${d.file_name}"`,
      `"${d.first_name} ${d.last_name}"`,
      `"${d.user_email}"`,
      d.doc_type,
      d.file_size_bytes,
      d.uploaded_at
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `document_registry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const totalBytes = useMemo(() => {
    return documents.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0);
  }, [documents]);

  const docTypes = ["All Types", "transcript", "id_document", "personal_statement", "recommendation", "other"];

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full relative font-sans text-gray-900 dark:text-gray-100 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#2E004F] text-[#FFD700] rounded-lg shadow-sm">
              <FolderOpen size={22} />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-[#2E004F] dark:text-white uppercase">
              Centralized Document & Credential Registry
            </h1>
          </div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
            Store, audit, and verify admission transcripts, government identity cards, and academic statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#2E004F] bg-[#FFD700] hover:bg-yellow-400 rounded-lg transition-all shadow-md active:scale-95"
          >
            <FilePlus size={16} /> Upload Document
          </button>
        </div>
      </div>

      {uploadSuccess && (
        <div className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 p-3.5 rounded-xl mb-4 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 size={18} /> {uploadSuccess}
        </div>
      )}

      {/* Registry Analytics KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-l-4 border-l-[#2E004F]">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Registered Files</div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">{meta.total}</div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-l-4 border-l-emerald-500">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Verified Transcripts</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {documents.filter(d => d.doc_type === 'transcript').length}
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-l-4 border-l-blue-500">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">ID & Passports</div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
            {documents.filter(d => d.doc_type === 'id_document').length}
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 border-l-4 border-l-amber-500">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Vault Storage</div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {formatFileSize(totalBytes)}
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white dark:bg-[#1a1a1a] p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mb-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search filename, applicant name, or email..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FFD700] dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500">
            <Filter size={14} />
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs font-bold uppercase text-gray-800 dark:text-gray-200 focus:outline-none"
            >
              {docTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500">
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs font-bold uppercase text-gray-800 dark:text-gray-200 focus:outline-none"
            >
              <option value="all">All Verification Statuses</option>
              <option value="verified">Verified Only</option>
              <option value="pending">Pending Only</option>
              <option value="flagged">Flagged Only</option>
            </select>
          </div>

          <button
            onClick={fetchDocuments}
            disabled={isLoading}
            className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Refresh Registry"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Document Table */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden flex-1 flex flex-col min-h-[350px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-900/80 text-gray-700 dark:text-gray-400 uppercase font-black text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3.5">Document File</th>
                <th className="px-6 py-3.5">Applicant / Student</th>
                <th className="px-6 py-3.5">Doc Type</th>
                <th className="px-6 py-3.5">Verification</th>
                <th className="px-6 py-3.5">File Size</th>
                <th className="px-6 py-3.5">Uploaded</th>
                <th className="px-6 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {filteredDocuments.map((doc) => {
                const verification = doc.verification_status || "verified";
                return (
                  <tr key={doc.id} className="hover:bg-purple-50/20 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-[#2E004F] dark:text-[#FFD700] rounded-lg">
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-xs">
                            {doc.file_name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            ID: {doc.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="text-gray-400" size={14} />
                        <div>
                          <p className="font-bold text-gray-900 dark:text-gray-100">
                            {doc.first_name} {doc.last_name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {doc.user_email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        {doc.doc_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleVerificationStatus(doc)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase rounded-full border transition-all ${
                          verification === "verified"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : verification === "pending"
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                        }`}
                        title="Click to toggle verification status"
                      >
                        <ShieldCheck size={12} /> {verification}
                      </button>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500 dark:text-gray-400">
                      {formatFileSize(doc.file_size_bytes)}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-medium">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleView(doc)}
                          disabled={isPreviewLoading}
                          className="p-1.5 text-gray-600 hover:text-[#2E004F] dark:text-gray-300 dark:hover:text-[#FFD700] hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                          title="Preview Document"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDownload(doc.id)}
                          className="p-1.5 text-gray-600 hover:text-[#2E004F] dark:text-gray-300 dark:hover:text-[#FFD700] hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                          title="Download File"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filteredDocuments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-bold">
                    No matching documents found in registry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-6 py-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              Page {meta.page} of {meta.totalPages} • {meta.total.toLocaleString()} total documents
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={meta.page <= 1}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
                disabled={meta.page >= meta.totalPages}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
              <div className="flex items-center gap-3 truncate">
                <span className="p-2 bg-[#2E004F] text-[#FFD700] rounded-lg">
                  <FileText size={18} />
                </span>
                <div className="truncate">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white truncate">
                    {viewingDoc.file_name}
                  </h3>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">
                    Owner: {viewingDoc.first_name} {viewingDoc.last_name} ({viewingDoc.user_email})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                {viewingDocUrl && (
                  <a
                    href={viewingDocUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs font-semibold"
                    title="Open in new tab"
                  >
                    <ExternalLink size={16} />
                    <span className="hidden sm:inline">Open in Tab</span>
                  </a>
                )}
                <button
                  onClick={closePreview}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-100 dark:bg-gray-950 relative flex items-center justify-center p-2 sm:p-4 overflow-hidden">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-gray-200 border-t-[#FFD700] rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-gray-500">Decrypting & loading document...</p>
                </div>
              ) : viewingDocUrl ? (
                (() => {
                  const isPdf = viewingDoc.file_name.toLowerCase().endsWith('.pdf') || viewingDoc.mime_type === 'application/pdf';
                  const isImage = !isPdf && (
                    ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'].includes(viewingDoc.mime_type || '') ||
                    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(viewingDoc.file_name)
                  );

                  if (isPdf) {
                    return (
                      <iframe
                        src={`${viewingDocUrl}#toolbar=1`}
                        title={viewingDoc.file_name}
                        className="w-full h-full border-0 rounded-lg shadow-sm bg-white"
                      />
                    );
                  }

                  if (isImage) {
                    return (
                      <img
                        src={viewingDocUrl}
                        alt={viewingDoc.file_name}
                        className="max-h-full max-w-full object-contain shadow-lg rounded"
                      />
                    );
                  }

                  return (
                    <div className="text-center p-8 max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800">
                      <FileText size={48} className="mx-auto mb-3 text-[#2E004F] dark:text-[#FFD700]" />
                      <h4 className="font-bold text-base text-gray-900 dark:text-white mb-1">{viewingDoc.file_name}</h4>
                      <p className="text-xs text-gray-500 mb-4">
                        This document type cannot be displayed directly inside the browser. You can download it to view.
                      </p>
                      <button
                        onClick={() => handleDownload(viewingDoc.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#2E004F] text-[#FFD700] hover:bg-purple-950 text-xs font-bold uppercase rounded-lg shadow-sm"
                      >
                        <Download size={14} /> Download File
                      </button>
                    </div>
                  );
                })()
              ) : (
                <div className="text-center p-6 text-gray-500">
                  <AlertCircle size={36} className="mx-auto mb-2 text-rose-500" />
                  <p className="font-bold text-sm">Preview unavailable for this document.</p>
                  <p className="text-xs text-gray-400 mt-1">Try downloading the file directly below.</p>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-between items-center text-xs">
              <span className="font-mono text-gray-400">
                Type: {viewingDoc.doc_type.toUpperCase()} • {formatFileSize(viewingDoc.file_size_bytes)}
              </span>
              <button
                onClick={() => handleDownload(viewingDoc.id)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#2E004F] text-[#FFD700] hover:bg-purple-950 text-xs font-black uppercase tracking-wider rounded-lg shadow-sm"
              >
                <Download size={14} /> Download File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800 animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-[#2E004F] text-[#FFD700] rounded-lg">
                  <UploadCloud size={18} />
                </span>
                <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  Upload Credential File
                </h3>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              {uploadError && (
                <div className="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 p-3 rounded-lg border border-rose-200 dark:border-rose-800 text-[11px] font-semibold">
                  <AlertCircle size={14} className="inline mr-1.5 -mt-0.5" />
                  {uploadError}
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Credential File *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                    if (file && !uploadFormData.file_name) {
                      setUploadFormData((prev) => ({ ...prev, file_name: file.name }));
                    }
                  }}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Document File Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John_Doe_Official_Transcript.pdf"
                  value={uploadFormData.file_name}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, file_name: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Student First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="John"
                    value={uploadFormData.first_name}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, first_name: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Student Last Name</label>
                  <input
                    type="text"
                    placeholder="Doe"
                    value={uploadFormData.last_name}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, last_name: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Student Email *</label>
                <input
                  type="email"
                  required
                  placeholder="john.doe@example.com"
                  value={uploadFormData.user_email}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, user_email: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Document Category</label>
                <select
                  value={uploadFormData.doc_type}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, doc_type: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 font-medium focus:ring-2 focus:ring-[#FFD700] outline-none"
                >
                  <option value="transcript">Official Transcript</option>
                  <option value="id_document">Passport / Government Identity Card</option>
                  <option value="recommendation">Recommendation Letter</option>
                  <option value="personal_statement">Personal Statement</option>
                  <option value="other">Other Credential</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 font-black uppercase text-xs tracking-wider bg-[#2E004F] text-[#FFD700] hover:bg-purple-950 rounded-lg shadow-md transition-all"
                >
                  {isUploading ? "Uploading..." : "Save to Vault"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDocuments;
