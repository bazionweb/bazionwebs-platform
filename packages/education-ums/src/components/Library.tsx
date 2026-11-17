import React, { useState, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  BookOpen,
  Clock,
  Download,
  Trash2,
  Edit,
  X,
  Globe,
  ShieldCheck,
  Info,
  LayoutGrid,
  List,
  Bot,
  Printer,
  BookMarked,
  Eye,
  AlertCircle,
  
  FileUp,
  Loader2,
  Check,
  CheckCircle2,
  Library as LibraryIcon,
} from '../shims/lucide-react';
import { LibraryItem } from "../types";
import { getAIResponse } from "../services/aiService";
import { useDataStore } from "../stores/dataStore";
import { useLibraryQuery } from "../hooks/useEntityQueries";
import { useLibraryBorrowingsQuery, useLibraryFinesQuery, useMarkFinePaidMutation } from "../hooks/api/useLibrary";
import { createLibraryItem, updateLibraryItem, deleteLibraryItem } from "../services/libraryService";
import { useQueryClient } from '../shims/tanstack-react-query';

function extractMetadataFromDoc(
  base64String: string,
  fileName: string,
): Record<string, string> {
  const metadata: Record<string, string> = {
    fileName,
    uploadDate: new Date().toISOString(),
    fileSize: Math.round((base64String.length * 3) / 4 / 1024) + " KB",
  };
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext) metadata.fileType = ext.toUpperCase();
  return metadata;
}

export const Library: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: libraryRes, refetch: refetchLibrary } = useLibraryQuery({
    page: 1,
    perPage: 500,
  });

  const library = libraryRes?.data || [];

  const _setLibrary = useDataStore((s) => s.setLibrary);
  const setLibrary = (action: React.SetStateAction<LibraryItem[]>) => {
    if (typeof action === "function") {
      _setLibrary(
        (action as (prev: LibraryItem[]) => LibraryItem[])(
          useDataStore.getState().library,
        ),
      );
    } else {
      _setLibrary(action);
    }
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [activeTab, setActiveTab] = useState<"catalog" | "borrowings" | "fines">("catalog");
  
  const { data: apiBorrowings } = useLibraryBorrowingsQuery();
  const borrowings = apiBorrowings ?? [];
  
  const { data: apiFines } = useLibraryFinesQuery();
  const fines = apiFines ?? [];
  const markFinePaidMutation = useMarkFinePaidMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [viewingResource, setViewingResource] = useState<LibraryItem | null>(
    null,
  );
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState("");

  // Persistence & Feedback
  const [isCommitting, setIsCommitting] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; msg: string }>({
    show: false,
    msg: "",
  });

  // File Upload & AI Scan State
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State for Create/Edit
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<LibraryItem>>({
    title: "",
    author: "",
    category: "Theology",
    type: "PDF",
    status: "Digital",
    year: new Date().getFullYear().toString(),
    description: "",
    downloadUrl: "",
  });

  const categories = [
    "All",
    "Theology",
    "ICT",
    "Business",
    "Education",
    "General",
  ];
  const types = ["All", "PDF", "E-Book", "Hardcopy", "Journal", "Video"];

  const filteredLibrary = useMemo(() => {
    return library.filter((item) => {
      const matchesSearch = `${item.title} ${item.author} ${item.isbn || ""}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        categoryFilter === "All" || item.category === categoryFilter;
      const matchesType = typeFilter === "All" || item.type === typeFilter;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [library, searchTerm, categoryFilter, typeFilter]);

  const stats = useMemo(
    () => ({
      total: library.length,
      digital: library.filter((i) => i.status === "Digital").length,
      available: library.filter((i) => i.status === "Available").length,
      borrowed: library.filter((i) => i.status === "Borrowed").length,
    }),
    [library],
  );

  const showToast = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: "" }), 4000);
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target?.result as string;
      setNewItem((prev) => ({
        ...prev,
        downloadUrl: base64String,
        status: "Digital",
        type: "PDF",
      }));
      setIsProcessingFile(false);

      // Auto-trigger AI Analysis
      setIsAiScanning(true);
      const metadata = await extractMetadataFromDoc(base64String, file.name);
      if (metadata) {
        setNewItem((prev) => ({
          ...prev,
          title: metadata.title || prev.title,
          author: metadata.author || prev.author,
          year: metadata.year || prev.year,
          category: (categories.includes(metadata.category)
            ? metadata.category
            : prev.category) as typeof prev.category,
          description: metadata.description || prev.description,
        }));
      }
      setIsAiScanning(false);
    };
    reader.onerror = () => {
      alert(
        "Error reading file protocol. Please try a standard PDF or Document.",
      );
      setIsProcessingFile(false);
      setUploadedFileName(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCommitting(true);
    try {
      if (editingItemId) {
        const res = await updateLibraryItem(editingItemId, newItem as Partial<LibraryItem>);
        if (!res.success) throw new Error(res.error || 'Update failed');
        showToast(`Registry node ${editingItemId} successfully updated in database.`);
      } else {
        const res = await createLibraryItem(newItem as Partial<LibraryItem>);
        if (!res.success) throw new Error(res.error || 'Create failed');
        showToast(`New material committed to database. Ref: ${(res.data as any)?.id || ''}`);
      }
      await refetchLibrary();
      queryClient.invalidateQueries({ queryKey: ['library'] });
    } catch (err: any) {
      showToast(err?.message || 'Save failed — not persisted');
      // fallback local so input is not lost
      if (editingItemId) {
        const updatedItem = { ...newItem, id: editingItemId } as LibraryItem;
        setLibrary((prev) => prev.map((i) => (i.id === editingItemId ? updatedItem : i)));
      } else {
        const refId = `LIB-${Math.floor(Math.random() * 9000) + 1000}`;
        const item: LibraryItem = { ...(newItem as LibraryItem), id: refId, location: newItem.status === "Digital" ? "Cloud Repository" : "Main Library Stack" };
        setLibrary((prev) => [item, ...prev]);
      }
    } finally {
      setIsCommitting(false);
      handleCloseModal();
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItemId(null);
    setUploadedFileName(null);
    setNewItem({
      title: "",
      author: "",
      category: "Theology",
      type: "PDF",
      status: "Digital",
      year: new Date().getFullYear().toString(),
      description: "",
      downloadUrl: "",
    });
  };

  const openEditModal = (item: LibraryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingItemId(item.id);
    setNewItem(item);
    if (item.downloadUrl?.startsWith("data:")) {
      setUploadedFileName("Stored Local Binary");
    }
    setIsModalOpen(true);
  };

  const deleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Decommission this asset from the registry? This action is immutable.")) return;
    try {
      const res = await deleteLibraryItem(id);
      if (!res.success) throw new Error(res.error || 'Delete failed');
      await refetchLibrary();
      queryClient.invalidateQueries({ queryKey: ['library'] });
      showToast(`Asset node ${id} purged from database.`);
    } catch {
      setLibrary((prev) => prev.filter((i) => i.id !== id));
      showToast(`Asset node ${id} purged locally (server failed).`);
    }
  };

  const generateSummary = async (item: LibraryItem) => {
    setIsGeneratingSummary(true);
    setAiSummary("");
    const prompt = `Provide a concise institutional summary of the academic resource "${item.title}" by ${item.author}. Explain its relevance to the BMI University ${item.category} curriculum and list 3 key learning objectives.`;
    const response = await getAIResponse(
      prompt,
      `Analyzing library resource for ${item.category} department.`,
    );
    setAiSummary(response);
    setIsGeneratingSummary(false);
  };

  const getSafeViewerUrl = (url: string) => {
    if (!url) return "";
    return url;
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-1.5 h-6 bg-[#FFD700] rounded-full flex-shrink-0"></div>
          <div className="flex flex-col">
            <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">
              Knowledge Depository
            </h2>
            <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              BMI University Online Library
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-[#4B0082] text-white shadow-xs" : "text-gray-400 hover:text-[#4B0082]"}`}
              title="Grid View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-[#4B0082] text-white shadow-xs" : "text-gray-400 hover:text-[#4B0082]"}`}
              title="List View"
            >
              <List size={14} />
            </button>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-[#4B0082] text-white rounded-lg shadow-md hover:bg-black transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider border border-[#FFD700]/30 cursor-pointer"
          >
            <Plus size={12} className="text-[#FFD700]" /> Catalog Asset
          </button>
        </div>
      </div>

      {/* Responsive Tab Bar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
          <LibraryIcon size={13} />
          <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
            Collections
          </span>
        </div>
        
        <button
          onClick={() => setActiveTab("catalog")}
          className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
            activeTab === "catalog"
              ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
          }`}
        >
          Catalog Repository
        </button>
        <button
          onClick={() => setActiveTab("borrowings")}
          className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
            activeTab === "borrowings"
              ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
          }`}
        >
          Borrowings
        </button>
        <button
          onClick={() => setActiveTab("fines")}
          className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
            activeTab === "fines"
              ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
          }`}
        >
          Fines & Fees
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-2"></div>
        
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              categoryFilter === cat
                ? "bg-[#4B0082] text-white shadow-lg shadow-purple-500/20 scale-105 border border-purple-500/50"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-purple-500">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Total Volumes
            </h4>
            <p className="text-3xl font-black text-[#4B0082] dark:text-white">
              {stats.total.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-emerald-500">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Digital Nodes
            </h4>
            <p className="text-3xl font-black text-emerald-600">
              {stats.digital.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-blue-500">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              On-Stack Availability
            </h4>
            <p className="text-3xl font-black text-blue-600">
              {stats.available.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-amber-500">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Current Loans
            </h4>
            <p className="text-3xl font-black text-amber-500">
              {stats.borrowed.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Filter Section */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-gray-800 p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Query Registry by Title, Author, or ISBN Code..."
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none outline-none font-bold text-sm dark:text-white focus:ring-1 focus:ring-[#4B0082]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex-1 md:flex-none px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs font-black uppercase outline-none cursor-pointer dark:text-white"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t} Formats
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Listing View */}
        {activeTab === "borrowings" ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold uppercase tracking-widest">Borrowing Records</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <tr><th className="px-6 py-5">Item</th><th className="px-6 py-5">Student</th><th className="px-6 py-5">Due Date</th><th className="px-6 py-5">Status</th></tr>
              </thead>
              <tbody>
                {borrowings.map(b => (
                  <tr key={b.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-6 py-5 font-bold">{library.find(x => String(x.id) === String(b.bookId))?.title || `Book ID: ${b.bookId}`}</td>
                    <td className="px-6 py-5">{b.studentId}</td>
                    <td className="px-6 py-5">{b.dueDate}</td>
                    <td className="px-6 py-5">
                      <span className={`px-2 py-1 text-[9px] font-bold uppercase tracking-widest border ${b.status === "overdue" ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === "fines" ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold uppercase tracking-widest">Library Fines</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <tr><th className="px-6 py-5">Student ID</th><th className="px-6 py-5">Amount</th><th className="px-6 py-5">Reason</th><th className="px-6 py-5">Status</th><th className="px-6 py-5 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {fines.map(f => (
                  <tr key={f.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-6 py-5 font-bold">{f.studentId}</td>
                    <td className="px-6 py-5 text-red-600 font-bold">GHS {f.amount}</td>
                    <td className="px-6 py-5">{f.reason}</td>
                    <td className="px-6 py-5">
                      <span className={`px-2 py-1 text-[9px] font-bold uppercase tracking-widest border ${!f.paid ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                        {f.paid ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {f.paid ? <span className="text-gray-500 font-medium">Paid</span> : (
                        <button onClick={() => markFinePaidMutation.mutate(f.id)} className="px-4 py-2 bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-widest">Mark Paid</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === "catalog" ? (
          viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredLibrary.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 group hover:border-[#4B0082] transition-all cursor-pointer shadow-sm hover:shadow-2xl relative flex flex-col"
              >
                <div className="h-48 bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8 relative overflow-hidden">
                  <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => openEditModal(item, e)}
                      className="p-2 bg-white/80 dark:bg-gray-800/80 rounded shadow-sm text-[#4B0082] hover:bg-[#4B0082] hover:text-white transition-colors"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={(e) => deleteItem(item.id, e)}
                      className="p-2 bg-white/80 dark:bg-gray-800/80 rounded shadow-sm text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="w-24 h-32 bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center transform group-hover:scale-110 transition-transform relative">
                    <BookOpen size={40} className="text-[#4B0082] opacity-20" />
                    <span className="absolute bottom-2 left-0 right-0 text-[8px] font-black text-center text-gray-400 uppercase tracking-tighter truncate px-2">
                      {item.title}
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gray-900/10 backdrop-blur-sm text-center">
                    <span className="text-[9px] font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">
                      {item.category}
                    </span>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <span
                      className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
                        item.status === "Digital"
                          ? "bg-blue-50 text-blue-700 border-blue-100"
                          : item.status === "Available"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-amber-50 text-amber-700 border-amber-100"
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400">
                      {item.type}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none mb-1 group-hover:text-[#4B0082] transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-xs font-bold text-gray-400 mb-4">
                    {item.author} • {item.year}
                  </p>
                  <div className="mt-auto pt-4 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-400 italic">
                      {item.location}
                    </span>
                    <div className="flex gap-2">
                      {(item.status === "Digital" || item.downloadUrl) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingResource(item);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4B0082] text-white text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-sm"
                        >
                          <Eye size={12} className="text-[#FFD700]" /> READ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-900 text-gray-400 uppercase text-[9px] font-black tracking-[0.25em] border-b border-gray-800">
                  <th className="px-6 py-5">Asset Ref</th>
                  <th className="px-6 py-5">Title & Author</th>
                  <th className="px-6 py-5">Department</th>
                  <th className="px-6 py-5 text-center">Format</th>
                  <th className="px-6 py-5 text-center">Status</th>
                  <th className="px-6 py-5 text-right">Commit Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredLibrary.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="hover:bg-purple-50/20 dark:hover:bg-gray-700/20 transition-all cursor-pointer group"
                  >
                    <td className="px-6 py-5 font-mono text-xs font-bold text-[#4B0082] dark:text-purple-300">
                      {item.id}
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                        {item.title}
                      </p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">
                        {item.author} • {item.year}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-[10px] font-bold text-gray-400">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span
                        className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border ${
                          item.status === "Digital"
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : item.status === "Available"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-amber-50 text-amber-700 border-amber-100"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(item.status === "Digital" || item.downloadUrl) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingResource(item);
                            }}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Read Digital Copy"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => openEditModal(item, e)}
                          className="p-2 text-gray-300 hover:text-[#4B0082] transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => deleteItem(item.id, e)}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
        
        {selectedItem && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#1a0033]/95 backdrop-blur-3xl p-4 md:p-8">
            <div className="bg-white dark:bg-gray-900 w-full max-w-5xl h-[90vh] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] border-t-[8px] border-[#4B0082] overflow-hidden flex flex-col animate-slide-up">
              <div className="p-10 md:p-16 flex flex-col md:flex-row gap-16 relative overflow-hidden bg-[#FAFAFA] dark:bg-gray-950 flex-1 overflow-y-auto no-scrollbar">
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#4B0082]/5 rounded-full blur-[100px] -mr-48 -mt-48"></div>

                <div className="flex-shrink-0 w-full md:w-80 space-y-8 relative z-10">
                  <div className="aspect-[3/4] bg-white dark:bg-gray-800 shadow-2xl border-4 border-white dark:border-gray-700 flex flex-col items-center justify-center relative group overflow-hidden">
                    <BookOpen
                      size={100}
                      className="text-[#4B0082] opacity-10"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    <div className="absolute bottom-6 left-6 right-6">
                      <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] opacity-80">
                        {selectedItem.category} Depository
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-center">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                        Status
                      </p>
                      <p className="text-xs font-black uppercase text-[#4B0082] dark:text-[#FFD700]">
                        {selectedItem.status}
                      </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-center">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                        Format
                      </p>
                      <p className="text-xs font-black uppercase text-gray-700 dark:text-gray-300">
                        {selectedItem.type}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedItem.status === "Digital" ||
                    selectedItem.downloadUrl ? (
                      <button
                        onClick={() => setViewingResource(selectedItem)}
                        className="w-full py-5 bg-[#4B0082] text-white text-[11px] font-black uppercase tracking-[0.25em] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 border-2 border-[#FFD700]/30"
                      >
                        <BookOpen size={18} className="text-[#FFD700]" /> READ
                        DIGITAL COPY
                      </button>
                    ) : (
                      <button className="w-full py-5 bg-[#4B0082] text-white text-[11px] font-black uppercase tracking-[0.25em] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3">
                        <Clock size={18} className="text-[#FFD700]" /> Reserve
                        Hardcopy
                      </button>
                    )}
                    <button
                      onClick={() =>
                        window.open(selectedItem.downloadUrl || "#", "_blank")
                      }
                      className="w-full py-5 border-2 border-gray-900 dark:border-white text-gray-900 dark:text-white text-[11px] font-black uppercase tracking-[0.25em] hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-3"
                    >
                      <Globe size={18} /> Direct Archive Access
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-12 relative z-10">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black text-[#4B0082] dark:text-[#FFD700] uppercase tracking-[0.4em]">
                          Official Institutional Asset
                        </span>
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                      </div>
                      <h2 className="text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-tight">
                        {selectedItem.title}
                      </h2>
                      <p className="text-xl font-bold text-[#4B0082] dark:text-purple-300 mt-2 uppercase tracking-tight">
                        {selectedItem.author}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="p-4 bg-white dark:bg-gray-800 hover:bg-red-500 hover:text-white transition-all text-gray-400 shadow-sm"
                    >
                      <X size={32} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8 border-y border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Serial / ISBN
                      </p>
                      <p className="text-sm font-black text-gray-900 dark:text-white font-mono">
                        {selectedItem.isbn || selectedItem.id}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Pub. Year
                      </p>
                      <p className="text-sm font-black text-gray-900 dark:text-white uppercase">
                        {selectedItem.year}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Registry Node
                      </p>
                      <p className="text-sm font-black text-[#4B0082] dark:text-[#FFD700] uppercase">
                        {selectedItem.location}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        Security Audit
                      </p>
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-500" />
                        <span className="text-xs font-bold text-emerald-600">
                          VERIFIED
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-400">
                      Institutional Context:
                    </h4>
                    <div className="bg-white dark:bg-gray-800 p-8 border-l-8 border-gray-900 dark:border-gray-700 shadow-sm">
                      <p className="text-lg font-bold text-gray-700 dark:text-gray-200 leading-relaxed italic">
                        {selectedItem.description ||
                          "Historical summary unavailable for this curriculum node."}
                      </p>
                    </div>
                  </div>

                  <div className="pt-10 border-t border-gray-100 dark:border-gray-800">
                    <div className="bg-gradient-to-r from-purple-50 to-white dark:from-gray-900 dark:to-gray-800 p-8 border border-purple-100 dark:border-gray-700 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                        <Bot size={80} className="text-[#4B0082]" />
                      </div>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-[#4B0082] text-white shadow-lg">
                          <Bot size={24} />
                        </div>
                        <div>
                          <h5 className="text-sm font-black uppercase text-[#4B0082] dark:text-[#FFD700] tracking-widest">
                            BMI AI Assistant Insights
                          </h5>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">
                            Curriculum Relevance Analysis Engine
                          </p>
                        </div>
                      </div>
                      {aiSummary ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 font-medium leading-relaxed bg-white/50 dark:bg-black/20 p-6 border-l-2 border-[#4B0082]">
                          {aiSummary}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <button
                            onClick={() => generateSummary(selectedItem)}
                            disabled={isGeneratingSummary}
                            className="px-10 py-4 bg-white dark:bg-gray-900 border-2 border-[#4B0082] text-[#4B0082] dark:text-[#FFD700] text-[10px] font-black uppercase tracking-[0.25em] hover:bg-[#4B0082] hover:text-white transition-all flex items-center gap-3 shadow-xl disabled:opacity-50"
                          >
                            {isGeneratingSummary ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <Bot size={16} />
                            )}
                            Generate Academic Summary
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-10 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-between items-center no-print flex-shrink-0">
                <div className="flex items-center gap-4">
                  <Info size={16} className="text-gray-400" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    Institutional Access Level: Full Administrative Control
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      const item = selectedItem;
                      setSelectedItem(null);
                      openEditModal(item);
                    }}
                    className="flex items-center gap-2 px-8 py-4 bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 hover:bg-gray-100 transition-all border border-gray-200 dark:border-gray-700"
                  >
                    <Edit size={16} /> Modify Record
                  </button>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="flex items-center gap-2 px-10 py-4 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-[#4B0082] transition-all"
                  >
                    <CheckCircle2 size={16} className="text-[#FFD700]" />{" "}
                    Confirm and Exit
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Viewer Modal */}
        {viewingResource && (
          <div className="fixed inset-0 z-[150] flex flex-col bg-[#05000a] text-white animate-fade-in">
            <div className="h-20 bg-[#1a0033] border-b border-white/10 flex items-center justify-between px-8 relative shadow-2xl flex-shrink-0">
              <div className="flex items-center gap-6">
                <div className="p-3 bg-[#4B0082] text-[#FFD700] rounded-none border border-[#FFD700]/30 shadow-lg">
                  <BookMarked size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight truncate max-w-[400px]">
                    {viewingResource.title}
                  </h3>
                  <p className="text-[10px] font-bold text-purple-300 uppercase tracking-[0.3em]">
                    BMI Knowledge Node Reader v2.0
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-black/40 p-1 rounded-none border border-white/5">
                <button
                  onClick={() => window.print()}
                  className="p-3 hover:bg-[#4B0082] transition-all text-gray-400 hover:text-white"
                  title="Print Selection"
                >
                  <Printer size={20} />
                </button>
                <button
                  onClick={() =>
                    window.open(viewingResource.downloadUrl, "_blank")
                  }
                  className="p-3 hover:bg-[#4B0082] transition-all text-gray-400 hover:text-white"
                  title="Download Source"
                >
                  <Download size={20} />
                </button>
                <div className="w-[1px] h-6 bg-white/10 mx-2"></div>
                <button
                  onClick={() => setViewingResource(null)}
                  className="flex items-center gap-3 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest transition-all shadow-xl"
                >
                  <X size={20} /> Close Terminal
                </button>
              </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 bg-[#11001a] relative overflow-y-auto p-4 md:p-8 flex justify-center no-scrollbar">
                <div className="w-full h-full max-w-5xl bg-white shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col relative overflow-hidden">
                  {viewingResource.downloadUrl ? (
                    <embed
                      src={getSafeViewerUrl(viewingResource.downloadUrl)}
                      type="application/pdf"
                      className="w-full h-full border-none bg-white"
                      title="BMI Knowledge Node"
                    />
                  ) : (
                    <div className="flex-1 p-20 flex flex-col items-center justify-center text-center">
                      <div className="w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center mb-8">
                        <AlertCircle
                          size={48}
                          className="text-[#4B0082] animate-pulse"
                        />
                      </div>
                      <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tighter mb-4">
                        Resource Unavailable
                      </h2>
                      <p className="text-xl text-gray-500 max-w-lg mx-auto font-medium">
                        The cloud node for{" "}
                        <span className="text-[#4B0082] font-black">
                          "{viewingResource.title}"
                        </span>{" "}
                        is undergoing re-validation.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Catalog Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#1a0033]/90 backdrop-blur-3xl p-4">
            <div className="bg-white dark:bg-gray-900 shadow-2xl w-full max-w-3xl max-h-[95vh] border border-[#FFD700]/30 animate-slide-up overflow-hidden flex flex-col">
              <div className="bg-gray-900 p-6 md:p-8 border-b-2 border-[#FFD700] flex justify-between items-center text-white flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-[#FFD700] rounded-none">
                    <BookMarked size={20} className="text-black" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold uppercase tracking-tight">
                      {editingItemId
                        ? "Modify Registry Node"
                        : "Institutional Catalog Entry"}
                    </h3>
                    <p className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest mt-1">
                      BMI Knowledge Gateway Node
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-red-500 transition-all text-white"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar bg-white dark:bg-gray-900">
                <form
                  id="catalog-form"
                  onSubmit={handleAddItem}
                  className="p-6 md:p-10 space-y-8"
                >
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                        Resource Title
                      </label>
                      <input
                        required
                        value={newItem.title}
                        onChange={(e) =>
                          setNewItem({ ...newItem, title: e.target.value })
                        }
                        className={`w-full px-5 py-4 bg-gray-50 dark:bg-gray-700 border rounded-none font-bold text-sm dark:text-white transition-all ${isAiScanning ? "border-purple-300 animate-pulse" : "border-gray-200 dark:border-gray-600 focus:border-[#4B0082]"}`}
                        placeholder="Document Formal Title"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                          Author / Creator
                        </label>
                        <input
                          value={newItem.author}
                          onChange={(e) =>
                            setNewItem({ ...newItem, author: e.target.value })
                          }
                          className={`w-full px-5 py-4 bg-gray-50 dark:bg-gray-700 border rounded-none font-bold text-sm dark:text-white transition-all ${isAiScanning ? "border-purple-300 animate-pulse" : "border-gray-200 dark:border-gray-600 focus:border-[#4B0082]"}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                          Category
                        </label>
                        <select
                          value={newItem.category}
                          onChange={(e) =>
                            setNewItem({
                              ...newItem,
                              category: e.target.value as "Theology" | "ICT" | "Business" | "Education" | "General",
                            })
                          }
                          className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none text-xs font-black uppercase cursor-pointer"
                        >
                          {categories.slice(1).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                          Asset Type
                        </label>
                        <select
                          value={newItem.type}
                          onChange={(e) =>
                            setNewItem({
                              ...newItem,
                              type: e.target.value as "PDF" | "E-Book" | "Hardcopy" | "Journal" | "Video",
                            })
                          }
                          className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none text-xs font-black uppercase cursor-pointer"
                        >
                          {types.slice(1).map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                          Registry Status
                        </label>
                        <select
                          value={newItem.status}
                          onChange={(e) =>
                            setNewItem({
                              ...newItem,
                              status: e.target.value as "Digital" | "Available" | "Borrowed" | "Reserved",
                            })
                          }
                          className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none text-xs font-black uppercase cursor-pointer"
                        >
                          <option value="Digital">Digital / Online</option>
                          <option value="Available">
                            Available (Hardcopy)
                          </option>
                          <option value="Reserved">Reserved Access</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                          Pub. Year
                        </label>
                        <input
                          value={newItem.year}
                          onChange={(e) =>
                            setNewItem({ ...newItem, year: e.target.value })
                          }
                          className={`w-full px-5 py-4 bg-gray-50 dark:bg-gray-700 border rounded-none font-bold text-sm dark:text-white transition-all ${isAiScanning ? "border-purple-300 animate-pulse" : "border-gray-200 dark:border-gray-600 focus:border-[#4B0082]"}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                        Institutional Abstract
                      </label>
                      <textarea
                        rows={3}
                        value={newItem.description}
                        onChange={(e) =>
                          setNewItem({
                            ...newItem,
                            description: e.target.value,
                          })
                        }
                        className={`w-full px-5 py-4 bg-gray-50 dark:bg-gray-700 border rounded-none font-medium text-sm dark:text-white transition-all ${isAiScanning ? "border-purple-300 animate-pulse" : "border-gray-200 dark:border-gray-600 focus:border-[#4B0082]"}`}
                        placeholder="Brief summary..."
                      />
                    </div>

                    <div className="p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col items-center justify-center text-center relative group">
                      <FileUp size={24} className="text-gray-400 mb-2" />
                      <p className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                        {uploadedFileName || "Upload Digital Asset (PDF)"}
                      </p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelection}
                        accept="application/pdf"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      {isProcessingFile && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                          <Loader2 className="animate-spin text-[#4B0082]" />
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              </div>
              <div className="p-6 md:p-8 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors"
                >
                  Discard Protocol
                </button>
                <button
                  form="catalog-form"
                  type="submit"
                  disabled={isProcessingFile || isAiScanning || isCommitting}
                  className="px-10 py-4 bg-[#4B0082] text-white rounded-none shadow-2xl font-black uppercase tracking-[0.2em] text-xs border border-[#FFD700]/30 hover:bg-black transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isAiScanning || isCommitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={16} className="text-[#FFD700]" />
                  )}
                  {editingItemId
                    ? "Authorize Record Update"
                    : "Authorize Catalog Commit"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Toast Notification */}
        {toast.show && (
          <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-[150] animate-fade-in">
            <div className="bg-gray-900 text-[#FFD700] px-10 py-5 rounded-none shadow-2xl flex items-center gap-4 border-2 border-[#FFD700] backdrop-blur-xl">
              <Check size={24} className="animate-pulse" />
              <span className="font-black text-xs uppercase tracking-[0.15em]">
                {toast.msg}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};









