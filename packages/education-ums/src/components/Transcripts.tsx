import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Printer,
  
  FileText,
  BookOpen,
  X,
  ChevronRight,
  ShieldCheck,
  MessageCircle,
  Scroll,
  
  ZoomIn,
  ZoomOut,
  
} from '../shims/lucide-react';
import { Student } from "../types";
import {
  getStudentAcademicRecords,
  
  type AcademicRecordFlat,
} from "../services/academicRecordsService";
import { getPrograms } from "../services/catalogService";
import { getHtml2Pdf } from "../services/pdfService";
import { useTranslation } from '../shims/react-i18next';
import { DocumentService } from "../services/documentService";
import type { DocumentSecurityFeatures } from "../types/documents";
// useDataStore removed in favor of useEntityQueries
import { useUIStore } from "../stores/uiStore";
import { useStudentsQuery } from "../hooks/useEntityQueries";

import { formatAdmissionDate } from "./transcripts/transcriptUtils";
import { 
  TranscriptsProps, 
  PerformanceRecord, 
  EditableBlockKey, 
  BlockPosition, 
  TranscriptTemplateLayout, 
  TRANSCRIPT_LAYOUT_STORAGE_KEY, 
  DEFAULT_TRANSCRIPT_TEMPLATE_LAYOUT,
  TRANSCRIPT_TEMPLATE_LOCKED
} from "./transcripts/TranscriptTypes";

/** Small toolbar button — copies the live layout JSON to clipboard so the
 *  user can paste it into the chat for the agent to lock the template. */
const CopyLayoutButton: React.FC<{ templateLayout: TranscriptTemplateLayout }> = ({ templateLayout }) => {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    const json = JSON.stringify(templateLayout, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers without clipboard API
      const ta = document.createElement("textarea");
      ta.value = json;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };
  return (
    <button
      onClick={handleCopy}
      className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded border ${copied ? "bg-green-500 text-white border-green-400" : "bg-gray-700 text-white hover:bg-gray-600 border-white/20"}`}
      title="Copy current layout JSON to clipboard — paste into chat to lock template"
    >
      {copied ? "✓ Copied!" : "Copy Layout JSON"}
    </button>
  );
};

export const Transcripts: React.FC<TranscriptsProps> = (props) => {
  const { t } = useTranslation();
  // Source data from TanStack Query
  const { data: studentsRes } = useStudentsQuery({
    page: 1,
    perPage: 1000,
  });

  const storeStudents = studentsRes?.data?.items || [];
  const storeLogo = useUIStore((s) => s.logo);
  const students = props.students ?? storeStudents ?? [];
  const logo = props.logo ?? storeLogo ?? "";
  const [searchTerm, setSearchTerm] = useState("");
  const [programFilter, setProgramFilter] = useState("All Programs");
  const [programOptions, setProgramOptions] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptType, setTranscriptType] = useState<
    "Official" | "Provisional"
  >("Official");
  const [selectedTerm] = useState("Fall 2023");
  const [zoomLevel, setZoomLevel] = useState(100); // Zoom percentage
  const [studentGrades, setStudentGrades] = useState<AcademicRecordFlat[]>([]);
  const [, setLoadingGrades] = useState(false);
  const [editorMode, setEditorMode] = useState(false);
  // Primary selected block (drives toolbar / arrow-key movement)
  const [selectedBlock, setSelectedBlock] = useState<EditableBlockKey | null>(null);
  // Full multi-select set — Shift+click adds/removes blocks
  const [selectedBlocks, setSelectedBlocks] = useState<Set<EditableBlockKey>>(new Set());
  const [templateLayout, setTemplateLayout] =
    useState<TranscriptTemplateLayout>(DEFAULT_TRANSCRIPT_TEMPLATE_LAYOUT);
  const [securityData, setSecurityData] =
    useState<DocumentSecurityFeatures | null>(null);
  const [history, setHistory] = useState<TranscriptTemplateLayout[]>([]);
  const dragStartLayoutRef = React.useRef<TranscriptTemplateLayout | null>(null);

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setTemplateLayout(previous);
  };
  const dragRef = React.useRef<{
    type: "move" | "resize-table-height";
    key?: EditableBlockKey;
    startX: number;
    startY: number;
    originX?: number;
    originY?: number;
    originTableHeightMm?: number;
    /** origins for ALL blocks in the active multi-select — populated when >1 block selected */
    multiOrigins?: Partial<Record<EditableBlockKey, { x: number; y: number }>>;
  } | null>(null);

//   const _terms = ["Fall 2022", "Spring 2023", "Fall 2023", "Spring 2024"];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getPrograms();
      if (cancelled || !r.success || !r.data) return;
      setProgramOptions(
        r.data.map((p: any) => ({
          id: String(p.id),
          label: `${String(p.program_code ?? "")} — ${String(p.name ?? "")}`,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (TRANSCRIPT_TEMPLATE_LOCKED) {
      setTemplateLayout(DEFAULT_TRANSCRIPT_TEMPLATE_LAYOUT);
      return;
    }
    try {
      const raw = localStorage.getItem(TRANSCRIPT_LAYOUT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TranscriptTemplateLayout>;
      if (!parsed || !parsed.blocks) return;
      setTemplateLayout({
        rows:
          parsed.rows && parsed.rows > 0
            ? parsed.rows
            : DEFAULT_TRANSCRIPT_TEMPLATE_LAYOUT.rows,
        tableRowMm:
          parsed.tableRowMm && parsed.tableRowMm > 0
            ? parsed.tableRowMm
            : DEFAULT_TRANSCRIPT_TEMPLATE_LAYOUT.tableRowMm,
        blocks: {
          ...DEFAULT_TRANSCRIPT_TEMPLATE_LAYOUT.blocks,
          ...parsed.blocks,
        },
      });
    } catch {
      // Ignore invalid persisted layout and fallback to defaults.
    }
  }, []);

  useEffect(() => {
    if (TRANSCRIPT_TEMPLATE_LOCKED) return;
    localStorage.setItem(
      TRANSCRIPT_LAYOUT_STORAGE_KEY,
      JSON.stringify(templateLayout),
    );
  }, [templateLayout]);

  const updateBlockPosition = (
    key: EditableBlockKey,
    patch: Partial<BlockPosition>,
    pushHistory = false,
  ) => {
    if (pushHistory || patch.align !== undefined) {
      setHistory((prev) => [...prev, templateLayout]);
    }
    setTemplateLayout((prev) => ({
      ...prev,
      blocks: {
        ...prev.blocks,
        [key]: { ...prev.blocks[key], ...patch },
      },
    }));
  };

  const getBlockStyle = (key: EditableBlockKey): React.CSSProperties => {
    const { x, y, align } = templateLayout.blocks[key];
    return {
      transform: `translate(${x}px, ${y}px)`,
      textAlign: align ?? "left",
      cursor: editorMode ? "move" : "default",
      position: "relative",
      zIndex: 10,
    };
  };

  const toSafeNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  };

  const formatNumber = (value: unknown, digits = 2): string => {
    return toSafeNumber(value).toFixed(digits);
  };

  // Fetch grades when a student is selected — source of truth: unified D1 backend
  useEffect(() => {
    if (!selectedStudent) {
      setStudentGrades([]);
      return;
    }

    const fetchGrades = async () => {
      setLoadingGrades(true);
      try {
        const records = await getStudentAcademicRecords(selectedStudent.id);
        // eslint-disable-next-line no-console
        console.log(`[Transcripts] Fetched ${records.length} grade records for student ${selectedStudent.id}`);
        
        // Check for duplicates in the fetched data
        const courseCodes = records.map(r => r.courseCode);
        const uniqueCodes = new Set(courseCodes);
        if (courseCodes.length !== uniqueCodes.size) {
          // eslint-disable-next-line no-console
          console.warn(`[Transcripts] API returned duplicate courses! Total: ${courseCodes.length}, Unique: ${uniqueCodes.size}`);
          
          // Log which courses are duplicated
          const counts = new Map<string, number>();
          courseCodes.forEach(code => counts.set(code, (counts.get(code) || 0) + 1));
          const duplicates = Array.from(counts.entries()).filter(([_, count]) => count > 1);
          // eslint-disable-next-line no-console
          console.warn('[Transcripts] Duplicated courses:', duplicates);
        }
        
        setStudentGrades(records);
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error("[Transcripts] Error fetching grades:", error);
        setStudentGrades([]);
      } finally {
        setLoadingGrades(false);
      }
    };

    fetchGrades();
  }, [selectedStudent]);

  // Fetch or generate security features when a transcript is generated
  useEffect(() => {
    let active = true;
    if (!showTranscript || !selectedStudent) {
      setSecurityData(null);
      return;
    }

    const initSecurity = async () => {
      const docService = DocumentService.getInstance();
      try {
        // Build a SHA-256 content hash from the student's actual grade records
        // so the backend can detect if grades changed after issuance.
        const gradePayload = JSON.stringify(
          studentGrades
            .map((g) => ({
              course: g.courseCode,
              score: g.totalScore,
              grade: g.grade,
            }))
            .sort((a, b) => a.course.localeCompare(b.course)),
        );
        const gradeHashBuf = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(gradePayload + selectedStudent.id),
        );
        const contentHash = Array.from(new Uint8Array(gradeHashBuf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // ALWAYS call createDocument() for transcripts — never serve a cached
        // localStorage record.  Old records use the ?s= URL scheme and are
        // stored only in the issuing browser, making QR verification fail on
        // any other device.  createDocument() calls generateSecurityFeatures()
        // which registers the transcript server-side (idempotent — returns
        // the existing serial+token if one already exists for this student)
        // and builds a proper ?id=SERIAL&t=TOKEN URL.
        const doc = await docService.createDocument(
          "transcript",
          selectedStudent.id,
          {
            studentName:
              `${selectedStudent.first_name} ${selectedStudent.last_name}`.trim() ||
              selectedStudent.full_name,
            program:
              selectedStudent.program ||
              selectedStudent.program_code ||
              "Unknown",
            academicYear: `${new Date().getFullYear()}-${
              new Date().getFullYear() + 1
            }`,
            contentHash,
          } as any,
        );

        if (active) {
          setSecurityData(doc.security);
        }
      } catch (error: unknown) { // eslint-disable-next-line no-console
        console.error("[Transcripts] Error initializing security data:", error);
      }
    };

    initSecurity();
    return () => {
      active = false;
    };
  }, [showTranscript, selectedStudent, transcriptType, selectedTerm]);

  const handleZoomIn = () => setZoomLevel((prev) => prev + 10);
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 10));
  const handleZoomReset = () => setZoomLevel(100);

  // Mouse wheel zoom
  React.useEffect(() => {
    if (!showTranscript) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          handleZoomIn();
        } else {
          handleZoomOut();
        }
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [showTranscript]);

  React.useEffect(() => {
    if (!editorMode) return;
    const handleEditorKeys = (e: KeyboardEvent) => {
      // Ctrl+Z — undo
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Escape — clear all selection
      if (e.key === "Escape") {
        setSelectedBlock(null);
        setSelectedBlocks(new Set());
        return;
      }

      const targets = selectedBlocks.size > 0 ? selectedBlocks
        : selectedBlock ? new Set<EditableBlockKey>([selectedBlock])
        : new Set<EditableBlockKey>();
      if (targets.size === 0) return;

      const isArrow = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key);
      if (!isArrow) return;
      e.preventDefault();

      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;

      // Push a single history snapshot for the whole batch
      setHistory(prev => [...prev, templateLayout]);
      setTemplateLayout(prev => {
        const newBlocks = { ...prev.blocks };
        targets.forEach(k => {
          newBlocks[k] = { ...newBlocks[k], x: prev.blocks[k].x + dx, y: prev.blocks[k].y + dy };
        });
        return { ...prev, blocks: newBlocks };
      });
    };
    window.addEventListener("keydown", handleEditorKeys);
    return () => window.removeEventListener("keydown", handleEditorKeys);
  }, [editorMode, selectedBlock, selectedBlocks, templateLayout, history]);

  React.useEffect(() => {
    if (!editorMode) return;
    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.type === "move" && drag.key) {
        const rawDx = event.clientX - drag.startX;
        const rawDy = event.clientY - drag.startY;
        // Compensate for zoom so 1px on screen = correct layout px
        const scale = 100 / zoomLevel;
        const dx = rawDx * scale;
        const dy = rawDy * scale;

        const origins = drag.multiOrigins;
        if (origins && Object.keys(origins).length > 1) {
          // ── Multi-block move: update all selected blocks in one setState ──
          setTemplateLayout(prev => {
            const newBlocks = { ...prev.blocks };
            (Object.keys(origins) as EditableBlockKey[]).forEach(k => {
              const o = origins[k]!;
              newBlocks[k] = { ...newBlocks[k], x: o.x + dx, y: o.y + dy };
            });
            return { ...prev, blocks: newBlocks };
          });
        } else {
          // ── Single-block move ──
          updateBlockPosition(drag.key, {
            x: (drag.originX ?? 0) + dx,
            y: (drag.originY ?? 0) + dy,
          });
        }
      } else if (drag.type === "resize-table-height") {
        const dy = event.clientY - drag.startY;
        const scale = 100 / zoomLevel;
        const dyScaled = dy * scale;
        const changeMm = dyScaled / 3.7795;
        const originH = drag.originTableHeightMm ?? 130;
        const newH = Math.max(40, Math.min(220, originH + changeMm));
        setTemplateLayout((prev) => ({
          ...prev,
          tableHeightMm: newH,
        }));
      }
    };
    const onUp = () => {
      if (dragRef.current && dragStartLayoutRef.current) {
        const snapshot = dragStartLayoutRef.current;
        setHistory((prev) => [...prev, snapshot]);
        dragStartLayoutRef.current = null;
      }
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [editorMode, zoomLevel]);

  // Click and hold zoom
  const zoomIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const startZoom = (direction: "in" | "out") => {
    // Immediate zoom on click
    if (direction === "in") {
      handleZoomIn();
    } else {
      handleZoomOut();
    }

    // Start continuous zoom after 300ms delay
    const timeoutId = setTimeout(() => {
      zoomIntervalRef.current = setInterval(() => {
        if (direction === "in") {
          setZoomLevel((prev) => prev + 10);
        } else {
          setZoomLevel((prev) => Math.max(prev - 10, 10));
        }
      }, 100); // Zoom every 100ms while holding
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const stopZoom = () => {
    if (zoomIntervalRef.current) {
      clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = null;
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => stopZoom();
  }, []);

  // Keyboard shortcuts for zoom
  React.useEffect(() => {
    if (!showTranscript) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === "0") {
          e.preventDefault();
          handleZoomReset();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showTranscript]);

  const normalizeDepartment = (dept?: string) => {
    if (!dept) return "BIBLICAL STUDIES AND APPLIED MINISTRY";
    const d = dept.toUpperCase().trim();
    if (d === "BIBLICAL STUDIES & MINISTRY" || d === "BIBLICAL STUDIES" || d === "DEPARTMENT OF BIBLICAL STUDIES AND APPLIED MINISTRY") {
      return "BIBLICAL STUDIES AND APPLIED MINISTRY";
    }
    // Also remove "DEPARTMENT OF " prefix if it exists in any other dept name
    return d.replace(/^DEPARTMENT OF\s+/i, "");
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = `${s.first_name} ${s.last_name} ${s.id}`
        .toLowerCase()
        .includes(q);
      const matchesProgram =
        programFilter === "All Programs" || s.program_code === programFilter;
      return matchesSearch && matchesProgram;
    });
  }, [students, searchTerm, programFilter]);

  const getPerformanceRecords = (_student: Student): PerformanceRecord[] => {
    if (studentGrades.length === 0) return [];

    // Map grades to performance records
    const records = studentGrades.map((r) => ({
      courseCode: r.courseCode || "N/A",
      courseName: r.courseTitle || "Untitled Course",
      credits: r.creditHours,
      score: r.totalScore,
      grade: r.grade || "F",
      points: r.gradePoint,
      term:
        r.semester && r.academicYear
          ? `${r.semester} ${r.academicYear}`
          : r.semester || r.academicYear || "2025",
    }));

    // Deduplicate by courseCode - keep the first occurrence
    const seen = new Set<string>();
    const deduplicated = records.filter((r) => {
      if (seen.has(r.courseCode)) {
        // eslint-disable-next-line no-console
        console.warn(`[Transcripts] Duplicate course detected: ${r.courseCode} - ${r.courseName}`);
        return false;
      }
      seen.add(r.courseCode);
      return true;
    });

    // eslint-disable-next-line no-console
    console.log(`[Transcripts] Total grades: ${studentGrades.length}, After deduplication: ${deduplicated.length}`);
    
    return deduplicated;
  };

  const allRecords = useMemo(
    () => (selectedStudent ? getPerformanceRecords(selectedStudent) : []),
    [selectedStudent, studentGrades],
  );

  const currentRecords = useMemo(() => {
    if (transcriptType === "Official") return allRecords;
    return allRecords.filter((r) => r.term === selectedTerm);
  }, [allRecords, transcriptType, selectedTerm]);

  // Single-page A4 layout model (mm): fixed zones + computed table capacity.
  const FIXED_ROWS_PER_PAGE = 25;
  // Adjusted row height to accommodate the larger 53mm seal placeholder
  // (25 rows * 5.2mm) + 75 (top) + 8 (header) + 55 (bottom) + 16 (padding) = 284mm
//   const _TABLE_ROW_MM = templateLayout.tableRowMm ?? 5.2; 
// //   const _availableTableMm = Math.max(
//     0,
//     A4_HEIGHT_MM -
//       PAGE_PADDING_MM * 2 -
//       FIXED_TOP_MM -
//       FIXED_BOTTOM_MM -
//       TABLE_HEADER_MM,
//   );
  const rowsPerPage = FIXED_ROWS_PER_PAGE;
  const transcriptRecords = useMemo(
    () => currentRecords.slice(0, rowsPerPage),
    [currentRecords, rowsPerPage],
  );
  const hiddenCourseCount = Math.max(
    0,
    currentRecords.length - transcriptRecords.length,
  );
  const fixedRows = useMemo<(PerformanceRecord | null)[]>(
    () =>
      Array.from(
        { length: rowsPerPage },
        (_, idx) => transcriptRecords[idx] ?? null,
      ),
    [rowsPerPage, transcriptRecords],
  );

  const stats = useMemo(() => {
    const calculateAvg = (recs: PerformanceRecord[]) => {
      if (recs.length === 0) return "0.00";
      const sum = recs.reduce((acc, curr) => acc + curr.score, 0);
      return (sum / recs.length).toFixed(2);
    };
    return {
      current: calculateAvg(currentRecords),
      cumulative: calculateAvg(allRecords),
    };
  }, [currentRecords, allRecords]);

  const getAcademicRecommendation = () => {
    if (!selectedStudent || currentRecords.length === 0) return "";

    const hasRetakes = currentRecords.some((r) => r.score < 40);
    const failedModules = currentRecords
      .filter((r) => r.score < 40)
      .map((r) => r.courseCode);

    const programName = (selectedStudent.program || selectedStudent.program_code || "DIPLOMA IN CHRISTIAN MINISTRY AND THEOLOGY").toUpperCase();
    const isDegree =
      programName.includes("DEGREE") || programName.includes("BACHELOR");
    const isMasters = programName.includes("MASTER");

    if (transcriptType === "Official") {
      if (hasRetakes) {
        return `AWARD PENDING SATISFACTORY COMPLETION OF SUPPLEMENTARY EXAMINATIONS FOR FAILED MODULES (${failedModules.join(", ")}).`;
      }

      const avg = parseFloat(stats.cumulative);
      let classification = "A PASS";

      if (isDegree || isMasters) {
        if (avg >= 70) classification = "FIRST CLASS HONOURS";
        else if (avg >= 60)
          classification = "SECOND CLASS HONOURS, UPPER DIVISION";
        else if (avg >= 50)
          classification = "SECOND CLASS HONOURS, LOWER DIVISION";
      } else {
        // Standard classifications for Diplomas and Certificates
        if (avg >= 70) classification = "A DISTINCTION";
        else if (avg >= 60) classification = "A CREDIT";
        else if (avg >= 50) classification = "A PASS";
      }

      // We ensure the award reads professionally. E.g., "AWARDED THE DIPLOMA IN THEOLOGY WITH A DISTINCTION."
      // If the program name lacks a prefix, we fallback nicely.
      let fullAwardTitle = programName;
      if (
        !fullAwardTitle.includes("DIPLOMA") &&
        !fullAwardTitle.includes("CERTIFICATE") &&
        !fullAwardTitle.includes("DEGREE") &&
        !fullAwardTitle.includes("BACHELOR")
      ) {
        fullAwardTitle = `CERTIFICATE IN ${fullAwardTitle}`;
      }

      return `HAVING SATISFIED THE BOARD OF EXAMINERS AND THE UNIVERSITY SENATE, IS HEREBY AWARDED THE ${fullAwardTitle} WITH ${classification}.`;
    } else {
      if (hasRetakes) {
        return `REQUIRED TO SIT FOR SUPPLEMENTARY EXAMINATIONS IN THE FAILED MODULES (${failedModules.join(", ")}) BEFORE PROCEEDING TO THE NEXT ACADEMIC LEVEL.`;
      }
      return `THE STUDENT HAS SATISFACTORILY COMPLETED THE ACADEMIC REQUIREMENTS FOR THE ${selectedTerm.toUpperCase()} PERIOD AND IS RECOMMENDED TO PROCEED TO THE NEXT PHASE OF STUDY.`;
    }
  };




  const handlePrint = async (mode: "print" | "download" = "print") => {
    if (!selectedStudent) return;
    const element = document.getElementById("official-transcript-root");
    if (!element) return;
    const fileName =
      `${transcriptType}_TRANSCRIPT_${selectedStudent.id}_${selectedStudent.last_name}`.toUpperCase();

    // Shared: inline all computed styles so the clone is a pixel-perfect replica
    const inlineStyles = (source: HTMLElement): HTMLElement => {
      const clone = source.cloneNode(true) as HTMLElement;
      const sourceEls = Array.from(
        source.querySelectorAll("*"),
      ) as HTMLElement[];
      const cloneEls = Array.from(clone.querySelectorAll("*")) as HTMLElement[];
      const rootCs = window.getComputedStyle(source);
      let rootInline = "";
      for (let i = 0; i < rootCs.length; i++) {
        const p = rootCs[i];
        rootInline += `${p}:${rootCs.getPropertyValue(p)};`;
      }
      clone.setAttribute("style", rootInline);
      sourceEls.forEach((el, idx) => {
        const cs = window.getComputedStyle(el);
        let inline = "";
        for (let i = 0; i < cs.length; i++) {
          const p = cs[i];
          inline += `${p}:${cs.getPropertyValue(p)};`;
        }
        cloneEls[idx].setAttribute("style", inline);
      });
      return clone;
    };

    if (mode === "download") {
      try {
        // Real PDF Download: Using html2pdf.js for maximum quality vector output
        const html2pdf = await getHtml2Pdf();

        const opt = {
          margin: [7, 7, 7, 7], // Reduced margins to match print layout
          filename: `${fileName}.pdf`,
          image: { type: "png", quality: 1.0 }, // PNG for lossless quality
          html2canvas: {
            scale: 4, // 384 DPI - optimal balance between quality and file size
            useCORS: true,
            letterRendering: true,
            logging: false,
            backgroundColor: "#ffffff",
            allowTaint: false,
            imageTimeout: 15000,
            width: 794, // A4 width in pixels at 96 DPI (210mm)
            windowWidth: 794,
            removeContainer: true,
            // High-quality rendering options
            foreignObjectRendering: false, // Use canvas rendering for better quality
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0,
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
            compress: true, // Compress for smaller file size without quality loss
            precision: 16,
            hotfixes: ["px_scaling"],
            putOnlyUsedFonts: true,
            floatPrecision: 16,
          },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
          enableLinks: false,
        };

        // Create high-quality PDF
        await html2pdf()
          .set(opt)
          .from(element)
          .toPdf()
          .get("pdf")
          .then((pdf: any) => {
            // Add metadata to the PDF
            pdf.setProperties({
              title: `Official Transcript - ${selectedStudent.first_name} ${selectedStudent.last_name}`,
              subject: "Official Academic Record",
              author: "BMI University Systems",
              keywords: "transcript, academic, record, BMI",
              creator: "BMI UMS",
            });
          })
          .save();
      } catch (error: unknown) { // eslint-disable-next-line no-console
        console.error("PDF download failed", error);
        alert(
          "High-quality PDF generation failed. Falling back to enhanced download...",
        );

        // Enhanced fallback with higher quality settings
        const { default: jsPDF  } = await import('../shims/jspdf');
        const { default: html2canvas } = await import('../shims/html2canvas');

        const canvas = await html2canvas(element, { 
          scale: 4, // Higher scale for better quality
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          imageTimeout: 15000,
        });
        
        const imgData = canvas.toDataURL("image/png", 1.0); // PNG with max quality
        const pdf = new jsPDF("p", "mm", "a4");
        
        // Add image with compression disabled for quality
        pdf.addImage(imgData, "PNG", 0, 0, 210, 297, undefined, "FAST");
        
        // Add metadata
        pdf.setProperties({
          title: `Official Transcript - ${selectedStudent.first_name} ${selectedStudent.last_name}`,
          subject: "Official Academic Record",
          author: "BMI University Systems",
        });
        
        pdf.save(`${fileName}.pdf`);
      }
    } else {
      // Print mode: Optimized for 'Save as PDF' browser feature to get a REAL vector PDF
      const cloned = inlineStyles(element);

      // Ensure all dark mode classes are removed for the official print
      const removeDarkClasses = (el: HTMLElement) => {
        el.classList.remove("dark");
        const children = el.querySelectorAll("*");
        children.forEach((child) => child.classList.remove("dark"));
      };
      removeDarkClasses(cloned);

      // Open print window sized to A4 at 96 DPI: 210mm × 297mm = 794 × 1123 px
      // Requirement 2.4: viewport matches A4 dimensions exactly
      const printWindow = window.open("", "_blank", "width=794,height=1123");
      if (!printWindow) return;

      // Build print HTML using centered container approach (no scaling/absolute positioning).
      // Requirements: 2.4 (A4 viewport), 3.1 (content fits within 210mm), 3.3 (symmetric margins)
      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=794, height=1123, initial-scale=1.0">
          <title>${fileName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@700&display=swap');

            * { 
              box-sizing: border-box; 
              margin: 0; 
              padding: 0; 
            }
            
            @page { 
              size: 210mm 297mm portrait; 
              margin: 0; 
            }
            
            html, body { 
              width: 210mm; 
              height: 297mm; 
              margin: 0 auto; 
              padding: 0; 
              background: white; 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
              color-adjust: exact !important;
              overflow: visible;
            }

            /* Centered container — no absolute/fixed positioning, no transforms/scaling.
               Requirement 3.3: symmetric margins via flexbox centering. */
            #print-container {
              width: 210mm;
              max-width: 210mm;
              height: 297mm;
              margin: 0 auto;
              padding: 0;
              overflow: visible;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              background: white;
              position: relative;
            }

            /* Constrain transcript root to A4 width so right border stays inside the page.
               Requirement 3.1: total content + padding + border <= 210mm. */
            #print-container > * {
              width: 210mm !important;
              max-width: 210mm !important;
              flex-shrink: 0;
              /* Remove any fixed/absolute positioning carried over from inline styles */
              position: relative !important;
              left: auto !important;
              top: auto !important;
              right: auto !important;
              bottom: auto !important;
              /* No transforms — they shift the paint layer outside the page boundary */
              transform: none !important;
            }

            /* High-quality text rendering */
            * {
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: optimizeLegibility;
            }

            /* Vector-quality image rendering */
            img, svg {
              image-rendering: -webkit-optimize-contrast;
              image-rendering: crisp-edges;
              shape-rendering: geometricPrecision;
            }

            @media print {
              html, body {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 auto !important;
              }

              #print-container {
                width: 210mm !important;
                max-width: 210mm !important;
                overflow: visible !important;
                margin: 0 auto !important;
              }

              #print-container > * {
                width: 210mm !important;
                max-width: 210mm !important;
                position: relative !important;
                left: auto !important;
                top: auto !important;
                transform: none !important;
              }

              /* Preserve border colours and backgrounds exactly */
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }

              img, svg, canvas {
                image-rendering: -webkit-optimize-contrast !important;
                image-rendering: crisp-edges !important;
              }
            }
          </style>
        </head>
        <body>
          <div id='print-container'>
            ${cloned.outerHTML}
          </div>
          <script>
            window.onload = () => {
              // Wait for fonts and images to load with timeout
              const fontPromise = document.fonts.ready;
              const imagePromises = Array.from(document.images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                  const timeout = setTimeout(() => resolve(), 5000);
                  img.onload = () => { clearTimeout(timeout); resolve(); };
                  img.onerror = () => { clearTimeout(timeout); resolve(); };
                });
              });
              
              Promise.all([fontPromise, ...imagePromises]).then(() => {
                // Additional delay to ensure full rendering
                setTimeout(() => {
                  window.print();
                  setTimeout(() => window.close(), 1000);
                }, 800);
              });
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(printHtml);
      printWindow.document.close();
    }
  };

  const handleShare = async (platform?: "whatsapp") => {
    if (!selectedStudent) return;
    const element = document.getElementById("official-transcript-root");
    if (!element) return;
    if (platform === "whatsapp") {
      try {
        const html2pdf = await getHtml2Pdf();
        const pdfBlob = await html2pdf()
          .from(element)
          .set({
            margin: 0,
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          })
          .output("blob");
        const file = new File(
          [pdfBlob],
          `TRANSCRIPT_${selectedStudent.id}.pdf`,
          { type: "application/pdf" },
        );
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${transcriptType} Academic Transcript`,
            text: `${transcriptType} transcript for ${selectedStudent.first_name} ${selectedStudent.last_name} (${selectedStudent.id})`,
          });
        } else {
          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(transcriptType + " Academic Transcript for " + selectedStudent.first_name + " " + selectedStudent.last_name + " (" + selectedStudent.id + ")")}`;
          window.open(waUrl, "_blank");
        }
      } catch { 
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent("Academic Transcript Link: " + window.location.href)}`;
        window.open(waUrl, "_blank");
      }
      return;
    }
    handlePrint("print");
  };

// //   const _handleDownloadWord = async () => {
//     await downloadWord({ selectedTerm,  selectedStudent: selectedStudent as any, getAcademicRecommendation, fixedRows, stats, transcriptType, securityData, logo });
//   };;

// //   const _handleDownloadSVG = async () => {
//     await downloadSVG({ selectedTerm,  selectedStudent: selectedStudent as any, getAcademicRecommendation, fixedRows, stats, transcriptType, securityData, logo });
//   };;

  const MicroText = ({ text }: { text: string }) => (
    <div className="relative overflow-hidden whitespace-nowrap text-[2.5px] md:text-[3px] leading-none text-gray-400 select-none uppercase tracking-tighter opacity-60 h-1 flex items-center bg-gradient-to-r from-purple-50/50 via-gray-50/50 to-purple-50/50 border-y border-gray-100/50">
      {/* Primary security text */}
      {Array.from({ length: 15 }).map((_, i) => (
        <span key={i} className="mr-4">
          {text}
        </span>
      ))}

      {/* Hidden layer - visible only under magnification */}
      <div className="absolute inset-0 flex items-center opacity-20 text-[1.5px]">
        {Array.from({ length: 30 }).map((_, i) => (
          <span key={`hidden-${i}`} className="mr-2 text-red-600">
            AUTHENTIC
          </span>
        ))}
      </div>
    </div>
  );

  const startBlockDrag = (
    key: EditableBlockKey,
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (!editorMode) return;
    e.preventDefault();
    e.stopPropagation(); // prevent background deselect firing

    // ── Determine the new selection set ──────────────────────────────────
    let nextSelected: Set<EditableBlockKey>;
    if (e.shiftKey) {
      // Shift+click: toggle this block in/out of multi-select
      nextSelected = new Set(selectedBlocks);
      if (nextSelected.has(key)) {
        nextSelected.delete(key);
      } else {
        nextSelected.add(key);
      }
    } else if (selectedBlocks.has(key) && selectedBlocks.size > 1) {
      // Clicking a block that's already part of a multi-select keeps the group
      nextSelected = selectedBlocks;
    } else {
      // Plain click: select only this block
      nextSelected = new Set<EditableBlockKey>([key]);
    }
    setSelectedBlocks(nextSelected);
    setSelectedBlock(key);

    // ── Snapshot for undo ─────────────────────────────────────────────────
    dragStartLayoutRef.current = JSON.parse(JSON.stringify(templateLayout));

    // ── Capture origins for every block in the selection ─────────────────
    const multiOrigins: Partial<Record<EditableBlockKey, { x: number; y: number }>> = {};
    nextSelected.forEach(k => {
      multiOrigins[k] = { x: templateLayout.blocks[k].x, y: templateLayout.blocks[k].y };
    });

    dragRef.current = {
      type: "move",
      key,
      startX: e.clientX,
      startY: e.clientY,
      originX: templateLayout.blocks[key].x,
      originY: templateLayout.blocks[key].y,
      multiOrigins,
    };
  };

  const startTableRowHeightResize = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragStartLayoutRef.current = JSON.parse(JSON.stringify(templateLayout));
    dragRef.current = {
      type: "resize-table-height",
      startX: e.clientX,
      startY: e.clientY,
      originTableHeightMm: templateLayout.tableHeightMm ?? 130,
    };
  };

  const editorOutlineClass = (key: EditableBlockKey) => {
    if (!editorMode) return "";
    if (selectedBlock === key && selectedBlocks.size > 1) {
      // Primary block inside a multi-select
      return "outline outline-[3px] outline-amber-400 outline-dashed";
    }
    if (selectedBlocks.has(key)) {
      // Selected (single or part of multi-select group)
      return "outline outline-2 outline-amber-500";
    }
    // Available but not selected
    return "outline outline-1 outline-cyan-400/50 outline-dashed";
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-1.5 h-6 bg-[#FFD700] rounded-full flex-shrink-0"></div>
          <div className="flex flex-col">
            <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">
              Academic Records & Transcripts
            </h2>
            <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              BMI Registrar • Automated Grade Aggregation Node
            </p>
          </div>
        </div>
      </div>

      {/* Responsive Tab Bar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
        <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
          <Scroll size={13} />
          <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
            Document Type
          </span>
        </div>
        {["Official", "Provisional"].map((type) => (
          <button
            key={type}
            onClick={() => setTranscriptType(type as "Official" | "Provisional")}
            className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
              transcriptType === type
                ? "bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-none border border-gray-100 dark:border-gray-700 space-y-6 shadow-sm">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Search Registry..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none text-xs font-bold uppercase tracking-tight outline-none focus:ring-1 focus:ring-[#4B0082]"
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                    {t('academic.program')}
                  </label>
                  <select
                    value={programFilter}
                    onChange={(e) => setProgramFilter(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-none text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-[#4B0082] cursor-pointer dark:text-gray-200"
                  >
                    <option value="All Programs">All {t('academic.programs')}</option>
                    {programOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-6 border-t border-gray-50 dark:border-gray-700">
                <div className="max-h-[400px] overflow-y-auto no-scrollbar space-y-1">
                  {filteredStudents.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => {
                        setSelectedStudent(student);
                        setShowTranscript(false);
                      }}
                      className={`w-full text-left p-3 rounded-none transition-all flex items-center justify-between group ${selectedStudent?.id === student.id ? "bg-[#4B0082] text-white shadow-lg" : "hover:bg-purple-50 dark:hover:bg-gray-700"}`}
                    >
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-tight leading-none">
                          {student.first_name} {student.last_name}
                        </p>
                        <p
                          className={`text-[9px] font-bold uppercase mt-1 ${selectedStudent?.id === student.id ? "text-purple-200" : "text-gray-400"}`}
                        >
                          {student.id}
                        </p>
                      </div>
                      <ChevronRight
                        size={14}
                        className={
                          selectedStudent?.id === student.id
                            ? "text-[#FFD700]"
                            : "text-gray-300"
                        }
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {selectedStudent ? (
              <div className="space-y-6 animate-slide-up">
                <div className="bg-white dark:bg-gray-800 rounded-none shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-2 h-full bg-[#4B0082]"></div>
                  <div className="p-8 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-8">
                      <div
                        className={`w-28 h-28 rounded-none ${selectedStudent.avatar_color} border-2 border-[#FFD700] p-1 shadow-2xl overflow-hidden`}
                      >
                        {selectedStudent.photo ? (
                          <img
                            src={selectedStudent.photo}
                            className="w-full h-full object-cover"
                            style={{
                              transform: `scale(${selectedStudent.photo_zoom})`,
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white">
                            {selectedStudent.first_name[0]}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">
                          {selectedStudent.first_name}{" "}
                          {selectedStudent.last_name}
                        </h3>
                        <p className="text-xs font-bold text-[#4B0082] dark:text-[#FFD700] uppercase tracking-widest mt-3">
                          {selectedStudent.program_code} • {selectedStudent.id}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowTranscript(true)}
                      className="px-10 py-4 bg-[#FFD700] text-[#4B0082] rounded-none font-black text-xs uppercase tracking-widest shadow-xl hover:bg-white transition-all flex items-center gap-3"
                    >
                      <FileText size={18} /> Generate Transcript
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-none shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="p-6 bg-gray-900 text-white flex justify-between items-center border-b border-gray-800">
                    <div className="flex items-center gap-3">
                      <BookOpen size={18} className="text-[#FFD700]" />
                      <h3 className="font-black text-xs uppercase tracking-[0.25em]">
                        Live Academic Performance Node
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                      <ShieldCheck size={14} className="text-emerald-500" />{" "}
                      SYSTEM VERIFIED RECORDS
                    </div>
                  </div>
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">
                          <th className="px-6 py-4">Module Identifier</th>
                          <th className="px-6 py-4">Specification</th>
                          <th className="px-6 py-4 text-center">Score (%)</th>
                          <th className="px-6 py-4 text-center">Grade</th>
                          <th className="px-6 py-4 text-center">Term</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {transcriptRecords.map((rec, i) => (
                          <tr
                            key={i}
                            className="hover:bg-purple-50/20 dark:hover:bg-gray-700/20 transition-all group"
                          >
                            <td className="px-6 py-4 font-mono text-xs font-bold text-[#4B0082] dark:text-purple-300">
                              {rec.courseCode}
                            </td>
                            <td className="px-6 py-4 text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                              {rec.courseName}
                            </td>
                            <td className="px-6 py-4 text-center text-sm font-black text-gray-900 dark:text-white">
                              {rec.score}%
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`text-xl font-black ${rec.score >= 70 ? "text-emerald-600" : rec.score < 40 ? "text-red-600" : "text-[#4B0082] dark:text-[#FFD700]"}`}
                              >
                                {rec.grade}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center text-[10px] font-black uppercase text-gray-500">
                              {rec.term}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-none border-2 border-dashed border-gray-100 dark:border-gray-700 text-gray-400">
                <FileText size={80} className="mb-6 opacity-20" />
                <h3 className="text-xl font-black uppercase tracking-[0.3em] opacity-40">
                  Awaiting Record Selection
                </h3>
              </div>
            )}
          </div>
        </div>
      </div>

      {showTranscript && selectedStudent && (
        <div className="fixed inset-0 z-[130] flex flex-col items-center bg-black/95 backdrop-blur-3xl overflow-y-auto">
          {/* Action Buttons - Fixed at top, not zoomed */}
          <div className="sticky top-0 z-50 w-full flex flex-wrap gap-4 items-center justify-between no-print p-6 bg-gray-900/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4B0082] via-[#FFD700] to-[#4B0082]"></div>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex bg-gray-800 p-1 border border-white/10 rounded-none mr-2">
                <button
                  onClick={() => setTranscriptType("Official")}
                  className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${transcriptType === "Official" ? "bg-[#FFD700] text-[#4B0082]" : "text-gray-400 hover:text-white"}`}
                >
                  Complete Registry
                </button>
                <button
                  onClick={() => setTranscriptType("Provisional")}
                  className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${transcriptType === "Provisional" ? "bg-[#FFD700] text-[#4B0082]" : "text-gray-400 hover:text-white"}`}
                >
                  Term Provisional
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-lg border border-white/10">
                <button
                  onMouseDown={() => startZoom("out")}
                  onMouseUp={stopZoom}
                  onMouseLeave={stopZoom}
                  onTouchStart={() => startZoom("out")}
                  onTouchEnd={stopZoom}
                  disabled={zoomLevel <= 10}
                  className="p-2 bg-gray-700 text-white hover:bg-gray-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed rounded select-none"
                  title="Zoom Out (Ctrl+- or Ctrl+Scroll)"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  onClick={handleZoomReset}
                  className="px-3 py-2 bg-gray-700 text-white hover:bg-gray-600 transition-all text-[10px] font-bold rounded min-w-[60px] select-none"
                  title="Reset Zoom (Ctrl+0)"
                >
                  {zoomLevel}%
                </button>
                <button
                  onMouseDown={() => startZoom("in")}
                  onMouseUp={stopZoom}
                  onMouseLeave={stopZoom}
                  onTouchStart={() => startZoom("in")}
                  onTouchEnd={stopZoom}
                  className="p-2 bg-gray-700 text-white hover:bg-gray-600 transition-all rounded select-none"
                  title="Zoom In (Ctrl++ or Ctrl+Scroll)"
                >
                  <ZoomIn size={16} />
                </button>
              </div>

              {!TRANSCRIPT_TEMPLATE_LOCKED && (
                <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg border border-white/10">
                  <button
                    onClick={() => setEditorMode((prev) => !prev)}
                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded ${editorMode ? "bg-amber-500 text-black" : "bg-gray-700 text-white hover:bg-gray-600"}`}
                  >
                    {editorMode ? "Editor On" : "Edit Template"}
                  </button>
                  {editorMode && (
                    <button
                      onClick={handleUndo}
                      disabled={history.length === 0}
                      className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded \${history.length > 0 ? "bg-cyan-500 text-black hover:bg-cyan-400" : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-55"}`}
                      title="Undo last layout action (Ctrl+Z)"
                    >
                      Undo
                    </button>
                  )}
                  {editorMode && (
                    <CopyLayoutButton templateLayout={templateLayout} />
                  )}
                  <label className="text-[9px] font-black uppercase text-gray-300">
                    Rows
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={templateLayout.rows}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isFinite(value)) {
                        setTemplateLayout((prev) => ({
                          ...prev,
                          rows: Math.max(1, Math.min(60, value)),
                        }));
                      }
                    }}
                    className="w-16 px-2 py-1 bg-gray-700 border border-white/20 text-white text-[10px] font-black"
                  />
                  {editorMode && (
                    <span className="text-[9px] font-black uppercase text-amber-300">
                      {selectedBlocks.size > 1
                        ? `${selectedBlocks.size} blocks selected`
                        : selectedBlock
                        ? `Selected: ${selectedBlock}`
                        : "Click block to select • Shift+click multi-select • Esc to deselect"}
                    </span>
                  )}
                  {editorMode && selectedBlocks.size > 0 && (
                    <div className="flex items-center gap-1">
                      {/* Clear selection */}
                      {selectedBlocks.size > 1 && (
                        <button
                          onClick={() => { setSelectedBlock(null); setSelectedBlocks(new Set()); }}
                          className="px-2 py-1 text-[9px] font-black bg-red-700/70 text-white border border-white/20 hover:bg-red-600"
                          title="Clear selection (Esc)"
                        >
                          ✕
                        </button>
                      )}
                      {/* Alignment — applies to ALL selected blocks */}
                      <button
                        onClick={() => {
                          setHistory(prev => [...prev, templateLayout]);
                          setTemplateLayout(prev => {
                            const nb = { ...prev.blocks };
                            selectedBlocks.forEach(k => { nb[k] = { ...nb[k], align: "left" }; });
                            return { ...prev, blocks: nb };
                          });
                        }}
                        className="px-2 py-1 text-[9px] font-black bg-gray-700 text-white border border-white/20 hover:bg-gray-600"
                        title="Align left (all selected)"
                      >
                        L
                      </button>
                      <button
                        onClick={() => {
                          setHistory(prev => [...prev, templateLayout]);
                          setTemplateLayout(prev => {
                            const nb = { ...prev.blocks };
                            selectedBlocks.forEach(k => { nb[k] = { ...nb[k], align: "center" }; });
                            return { ...prev, blocks: nb };
                          });
                        }}
                        className="px-2 py-1 text-[9px] font-black bg-gray-700 text-white border border-white/20 hover:bg-gray-600"
                        title="Align center (all selected)"
                      >
                        C
                      </button>
                      <button
                        onClick={() => {
                          setHistory(prev => [...prev, templateLayout]);
                          setTemplateLayout(prev => {
                            const nb = { ...prev.blocks };
                            selectedBlocks.forEach(k => { nb[k] = { ...nb[k], align: "right" }; });
                            return { ...prev, blocks: nb };
                          });
                        }}
                        className="px-2 py-1 text-[9px] font-black bg-gray-700 text-white border border-white/20 hover:bg-gray-600"
                        title="Align right (all selected)"
                      >
                        R
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => handlePrint("print")}
                className="flex items-center gap-2 px-8 py-3.5 bg-[#4B0082] text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg border border-white/10"
              >
                <Printer size={18} /> Print Record
              </button>
              {/* Output options disabled for print testing */}
              {/* <button
                onClick={() => handlePrint("download")}
                className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg border border-white/10"
              >
                <Download size={18} /> PDF Archive
              </button>
              <button
                onClick={handleDownloadWord}
                className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg border border-white/10"
              >
                <Download size={18} /> Word
              </button>
              <button
                onClick={handleDownloadSVG}
                className="flex items-center gap-2 px-8 py-3.5 bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg border border-white/10"
              >
                <Download size={18} /> SVG
              </button> */}
              <button
                onClick={() => handleShare("whatsapp")}
                className="flex items-center gap-2 px-8 py-3.5 bg-[#25D366] text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg border border-white/10"
              >
                <MessageCircle size={18} /> Send Data
              </button>
            </div>
            <button
              onClick={() => setShowTranscript(false)}
              className="p-4 bg-red-600 text-white hover:bg-red-700 transition-all shadow-xl group"
            >
              <X
                size={24}
                className="group-hover:rotate-90 transition-transform"
              />
            </button>
          </div>

          {/* Transcript Container - This gets zoomed */}
          <div className="w-full flex justify-center p-4 md:p-8 pt-8 md:pt-12">
            <div
              className="transcript-zoom-wrapper"
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: "top center",
                transition: "transform 0.2s ease-out",
                willChange: "transform",
              }}
            >
              <div
                id="official-transcript-root"
                className="bg-white shadow-2xl relative flex flex-col font-serif p-6 text-gray-950 print:m-0 print:shadow-none border-[6px] border-gray-100 border-double"
                style={{
                  width: "210mm",
                  height: "297mm",
                  padding: "7mm",
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
                onMouseDown={() => {
                  // Click on empty A4 background → clear all selection
                  if (editorMode) {
                    setSelectedBlock(null);
                    setSelectedBlocks(new Set());
                  }
                }}
              >
                {/* ENHANCED SECURITY LAYER - Multi-pattern anti-forgery system */}
                <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                  <svg
                    width="100%"
                    height="100%"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full opacity-[0.25]"
                  >
                    <defs>
                      {/* Holographic gradient - simulates color-shifting ink */}
                      <linearGradient
                        id="holographicShift"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stopColor="#FF00FF"
                          stopOpacity="0.15"
                        />
                        <stop
                          offset="25%"
                          stopColor="#00FFFF"
                          stopOpacity="0.15"
                        />
                        <stop
                          offset="50%"
                          stopColor="#FFFF00"
                          stopOpacity="0.15"
                        />
                        <stop
                          offset="75%"
                          stopColor="#FF00FF"
                          stopOpacity="0.15"
                        />
                        <stop
                          offset="100%"
                          stopColor="#00FFFF"
                          stopOpacity="0.15"
                        />
                      </linearGradient>

                      {/* Security pastel background */}
                      <linearGradient
                        id="securityPastel"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#fdf2f8" />
                        <stop offset="25%" stopColor="#f0f9ff" />
                        <stop offset="50%" stopColor="#f0fdf4" />
                        <stop offset="75%" stopColor="#fffbeb" />
                        <stop offset="100%" stopColor="#faf5ff" />
                      </linearGradient>

                      {/* Guilloche wave pattern */}
                      <pattern
                        id="blendedSecurityPattern"
                        x="0"
                        y="0"
                        width="300"
                        height="300"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M0,150 Q75,50 150,150 T300,150"
                          fill="none"
                          stroke="#4B0082"
                          strokeWidth="0.4"
                          opacity="0.4"
                        />
                      </pattern>

                      {/* VOID Pantograph - shows "VOID" when photocopied */}
                      <pattern
                        id="voidPantograph"
                        x="0"
                        y="0"
                        width="200"
                        height="100"
                        patternUnits="userSpaceOnUse"
                      >
                        {/* Fine lines that break on photocopy */}
                        <line
                          x1="0"
                          y1="20"
                          x2="200"
                          y2="20"
                          stroke="#4B0082"
                          strokeWidth="0.15"
                          opacity="0.3"
                        />
                        <line
                          x1="0"
                          y1="40"
                          x2="200"
                          y2="40"
                          stroke="#4B0082"
                          strokeWidth="0.15"
                          opacity="0.3"
                        />
                        <line
                          x1="0"
                          y1="60"
                          x2="200"
                          y2="60"
                          stroke="#4B0082"
                          strokeWidth="0.15"
                          opacity="0.3"
                        />
                        <line
                          x1="0"
                          y1="80"
                          x2="200"
                          y2="80"
                          stroke="#4B0082"
                          strokeWidth="0.15"
                          opacity="0.3"
                        />
                        {/* "VOID" text (visible on photocopy) */}
                        <text
                          x="50"
                          y="55"
                          fontSize="48"
                          fontWeight="900"
                          fill="#FF0000"
                          opacity="0.02"
                          fontFamily="sans-serif"
                        >
                          VOID
                        </text>
                      </pattern>

                      {/* Copy Detection Pattern - breaks on reproduction */}
                      <pattern
                        id="copyDetection"
                        x="0"
                        y="0"
                        width="50"
                        height="50"
                        patternUnits="userSpaceOnUse"
                      >
                        <circle
                          cx="25"
                          cy="25"
                          r="1"
                          fill="#4B0082"
                          opacity="0.15"
                        />
                        <circle
                          cx="0"
                          cy="0"
                          r="0.5"
                          fill="#FFD700"
                          opacity="0.1"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="0.5"
                          fill="#FFD700"
                          opacity="0.1"
                        />
                      </pattern>

                      {/* Latent image pattern - visible at angles */}
                      <pattern
                        id="latentImage"
                        x="0"
                        y="0"
                        width="100"
                        height="100"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M0,50 L100,50"
                          stroke="#4B0082"
                          strokeWidth="0.2"
                          opacity="0.25"
                        />
                        <path
                          d="M50,0 L50,100"
                          stroke="#4B0082"
                          strokeWidth="0.2"
                          opacity="0.25"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="20"
                          fill="none"
                          stroke="#FFD700"
                          strokeWidth="0.3"
                          opacity="0.2"
                        />
                      </pattern>

                      {/* Microprint pattern */}
                      <pattern
                        id="microprint"
                        x="0"
                        y="0"
                        width="150"
                        height="20"
                        patternUnits="userSpaceOnUse"
                      >
                        <text
                          x="0"
                          y="15"
                          fontSize="3"
                          fill="#4B0082"
                          opacity="0.3"
                          fontFamily="monospace"
                        >
                          BMI-SECURE
                        </text>
                        <text
                          x="75"
                          y="15"
                          fontSize="3"
                          fill="#4B0082"
                          opacity="0.3"
                          fontFamily="monospace"
                        >
                          AUTHENTIC
                        </text>
                      </pattern>
                    </defs>

                    {/* Layer 1: Pastel background */}
                    <rect
                      width="100%"
                      height="100%"
                      fill="url(#securityPastel)"
                    />

                    {/* Layer 2: Guilloche pattern */}
                    <rect
                      width="100%"
                      height="100%"
                      fill="url(#blendedSecurityPattern)"
                    />

                    {/* Layer 3: VOID Pantograph (anti-photocopy) */}
                    <rect
                      width="100%"
                      height="100%"
                      fill="url(#voidPantograph)"
                    />

                    {/* Layer 4: Copy detection dots */}
                    <rect
                      width="100%"
                      height="100%"
                      fill="url(#copyDetection)"
                    />

                    {/* Layer 5: Latent image */}
                    <rect width="100%" height="100%" fill="url(#latentImage)" />

                    {/* Layer 6: Microprint */}
                    <rect width="100%" height="100%" fill="url(#microprint)" />

                    {/* Layer 7: Holographic overlay */}
                    <rect
                      width="100%"
                      height="100%"
                      fill="url(#holographicShift)"
                      className="mix-blend-overlay"
                    />
                  </svg>

                  {/* Holographic foil effect (CSS-based) */}
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-transparent via-purple-200/5 to-transparent opacity-30 mix-blend-overlay pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(135deg, transparent 0%, rgba(255,0,255,0.05) 25%, rgba(0,255,255,0.05) 50%, rgba(255,255,0,0.05) 75%, transparent 100%)",
                      animation: "holographic-shift 10s ease-in-out infinite",
                    }}
                  />

                  {/* Large Center Logo Watermark */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.08] pointer-events-none">
                    <img
                      src={logo || "/BMI.svg"}
                      className="h-[32%] w-auto object-contain"
                      alt=""
                      style={{
                        filter: "grayscale(100%) contrast(0.7)",
                        transform: "translateY(18%)",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>

                  {/* Logo Watermark - Repeating BMI logo pattern */}
                  <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-32 opacity-[0.03] pointer-events-none">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <img
                        key={`watermark-${i}`}
                        src={logo || "/BMI.svg"}
                        className="w-32 h-32 object-contain grayscale"
                        alt=""
                        style={{
                          transform: `rotate(${i % 2 === 0 ? "-30deg" : "30deg"})`,
                          filter: "grayscale(100%) contrast(0.5)",
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div
                  className={`-mt-1 mb-1 ${editorOutlineClass("microTop")}`}
                  style={getBlockStyle("microTop")}
                  onClick={() => editorMode && setSelectedBlock("microTop")}
                  onMouseDown={(e) => startBlockDrag("microTop", e)}
                >
                  <MicroText
                    text={`BMI UNIVERSITY OFFICIAL ACADEMIC TRANSCRIPT • SECURITY VALIDATED RECORD • DO NOT REPRODUCE • UV PROTECTED INK • ANTI-FORGERY • ID: ${securityData?.serialNumber || "PENDING"}`}
                  />
                </div>

                {/* Seal — top left, mirrors the QR code on the right */}
                <div className="absolute top-8 left-8 flex flex-col items-center gap-1 z-20">
                  <img
                    src="/BMI SEAL.png"
                    className="w-16 h-16 object-cover scale-110"
                    alt="BMI University Seal"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>

                <div className="absolute top-8 right-8 flex flex-col items-center gap-1 group z-20">
                  <div className="p-1 bg-white border border-gray-900 shadow-sm relative">
                    {securityData?.qrCodeDataUrl ? (
                      <img
                        src={securityData.qrCodeDataUrl}
                        className="w-16 h-16"
                        alt="Security QR"
                      />
                    ) : (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&ecc=H&margin=1&data=${encodeURIComponent(`BMI UNIVERSITY - OFFICIAL ACADEMIC RECORD\nSTUDENT: ${selectedStudent.first_name} ${selectedStudent.last_name}\nID: ${selectedStudent.id}\nSTATUS: VERIFIED`)}`}
                        className="w-16 h-16"
                        alt="Security QR"
                      />
                    )}
                  </div>
                </div>

                <div
                  className={`flex flex-col items-center border-b-2 border-gray-900 pb-1 mb-1.5 relative z-10 ${editorOutlineClass("headerTitle")}`}
                  style={getBlockStyle("headerTitle")}
                  onClick={() => editorMode && setSelectedBlock("headerTitle")}
                  onMouseDown={(e) => startBlockDrag("headerTitle", e)}
                >
                  <img
                    src={logo || "/BMI.svg"}
                    className="h-10 mb-1 object-contain filter contrast-125"
                    alt="BMI Logo"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/BMI.svg";
                    }}
                  />
                  <h1 className="text-[24px] leading-none font-serif font-black tracking-tight text-gray-900 uppercase">
                    BMI UNIVERSITY
                  </h1>
                  <p className="text-[7px] font-sans font-black text-gray-600 uppercase tracking-[0.35em] mt-0.5">
                    OFFICE OF THE REGISTRAR
                  </p>
                  <div className="mt-1 px-7 py-0.5 border-y border-gray-900 bg-gradient-to-r from-purple-50/80 via-white to-purple-50/80">
                    <h2 className="text-[11px] font-serif font-black uppercase tracking-[0.26em] leading-tight">
                      {transcriptType} Academic Transcript
                      {transcriptType === "Provisional" && (
                        <span className="ml-3 bg-red-600 px-2 py-0.5 text-[10px] text-white">
                          | PERIOD: {selectedTerm.toUpperCase()}
                        </span>
                      )}
                    </h2>
                  </div>
                </div>

                <div
                  className={`mb-0.5 px-4 relative z-10 ${editorOutlineClass("studentName")}`}
                  style={getBlockStyle("studentName")}
                  onClick={() => editorMode && setSelectedBlock("studentName")}
                  onMouseDown={(e) => startBlockDrag("studentName", e)}
                >
                  <div className="border-y border-gray-300 py-0.5 flex items-center">
                    <span className="text-[7px] font-montserrat font-medium text-gray-400 uppercase tracking-widest absolute left-4">
                      STUDENT NAME:
                    </span>
                    <div className="w-full text-center">
                      <span className="text-[16px] leading-none font-serif font-bold text-[#4B0082] uppercase tracking-[0.15em]">
                        {selectedStudent.full_name ||
                          `${selectedStudent.first_name} ${selectedStudent.last_name}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className={`grid grid-cols-2 gap-x-12 gap-y-0.5 mb-1 text-[9px] relative z-10 px-4 ${editorOutlineClass("studentMeta")}`}
                  style={getBlockStyle("studentMeta")}
                  onClick={() => editorMode && setSelectedBlock("studentMeta")}
                  onMouseDown={(e) => startBlockDrag("studentMeta", e)}
                >
                  {/* Left Column */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between border-b border-gray-100 pb-0.5">
                      <span className="text-gray-400 font-montserrat text-[8px] uppercase tracking-wider font-medium">
                        STUDENT ID:
                      </span>
                      <span className="uppercase text-gray-950 font-montserrat font-bold tracking-wide">
                        {selectedStudent.reg_no ||
                          selectedStudent.id}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-0.5">
                      <span className="text-gray-400 font-montserrat text-[8px] uppercase tracking-wider font-medium">
                        SCHOOL:
                      </span>
                      <span className="uppercase text-gray-950 font-montserrat font-bold tracking-wide">
                        {selectedStudent.faculty || "SCHOOL OF THEOLOGY AND MINISTRY"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-0.5">
                      <span className="text-gray-400 font-montserrat text-[8px] uppercase tracking-wider font-medium">
                        PROGRAM:
                      </span>
                      <span className="uppercase text-gray-950 font-montserrat font-bold tracking-wide">
                        {selectedStudent.program || "DIPLOMA IN CHRISTIAN MINISTRY AND THEOLOGY"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-0.5">
                      <span className="text-gray-400 font-montserrat text-[8px] uppercase tracking-wider font-medium">
                        ADMISSION DATE:
                      </span>
                      <span className="uppercase text-gray-950 font-montserrat font-bold tracking-wide">
                        {selectedStudent.admission_date ? formatAdmissionDate(selectedStudent.admission_date) : "4TH FEB 2024"}
                      </span>
                    </div>
                  </div>
                  {/* Right Column */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between border-b border-gray-100 pb-0.5">
                      <span className="text-gray-400 font-montserrat text-[8px] uppercase tracking-wider font-medium">
                        AWARD TYPE:
                      </span>
                      <span className="uppercase text-gray-950 font-montserrat font-bold tracking-wide">
                        {selectedStudent.degree_level || selectedStudent.award_type || "DIPLOMA"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-0.5">
                      <span className="text-gray-400 font-montserrat text-[8px] uppercase tracking-wider font-medium">
                        DEPARTMENT:
                      </span>
                      <span className="uppercase text-gray-950 font-montserrat font-bold tracking-wide">
                        {normalizeDepartment(selectedStudent.department)}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-0.5">
                      <span className="text-gray-400 font-montserrat text-[8px] uppercase tracking-wider font-medium">
                        MODE OF STUDY:
                      </span>
                      <span className="uppercase text-gray-950 font-montserrat font-bold tracking-wide">
                        {(() => {
                          const isSeminary = selectedStudent.program?.toLowerCase().includes("diploma") || 
                                             selectedStudent.program?.toLowerCase().includes("ministry") || 
                                             selectedStudent.program?.toLowerCase().includes("theology");
                          return (selectedStudent.mode_of_study === "Part-Time" && isSeminary)
                            ? "PART-TIME (SEMINARY MODE)"
                            : (selectedStudent.mode_of_study || "FULL-TIME").toUpperCase();
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-0.5">
                      <span className="text-gray-400 font-montserrat text-[8px] uppercase tracking-wider font-medium">
                        GRADUATION DATE:
                      </span>
                      <span className="uppercase text-gray-950 font-montserrat font-bold tracking-wide">
                        {selectedStudent.graduation_date ? formatAdmissionDate(selectedStudent.graduation_date) : "1ST MAY 2026"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* TABLE — absolutely positioned, fully independent of all other blocks */}
                <div
                  className={`border border-gray-900 shadow-sm overflow-hidden ${editorOutlineClass("table")}`}
                  style={{
                    ...getBlockStyle("table"),
                    // Explicitly override getBlockStyle's position:"relative" so this element
                    // is truly absolute and never participates in the flex flow.
                    position: "absolute",
                    left: "8mm",
                    right: "8mm",
                    zIndex: 10,
                    height: `${templateLayout.tableHeightMm ?? 143}mm`,
                    minHeight: "40mm",
                  }}
                  onClick={() => editorMode && setSelectedBlock("table")}
                  onMouseDown={(e) => startBlockDrag("table", e)}
                >
                  <table className="w-full text-left text-[10px] border-collapse" style={{ height: "100%", tableLayout: "fixed" }}>
                    <thead>
                      <tr className="border-b border-gray-900 font-black uppercase bg-gray-50" style={{ height: '8mm' }}>
                        <th className="py-1.5 px-3 border-r border-gray-900 w-28">
                          Course Code
                        </th>
                        <th className="py-1.5 px-3 border-r border-gray-900">
                          Course Description
                        </th>
                        <th className="py-1.5 px-3 border-r border-gray-900 w-24 text-center">
                          Hours
                        </th>
                        <th className="py-1.5 px-3 w-16 text-center">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/80">
                      {fixedRows.map((rec, i) => (
                        <tr
                          key={i}
                          className="border-b border-gray-200 hover:bg-purple-50/20 transition-colors"
                          style={{ height: `${((templateLayout.tableHeightMm ?? 143) - 8) / (templateLayout.rows || 25)}mm` }}
                        >
                          <td className="py-0.5 px-3 border-r border-gray-900 font-mono font-bold text-gray-700 leading-none">
                            {rec?.courseCode ?? ""}
                          </td>
                          <td className="py-0.5 px-3 border-r border-gray-900 uppercase font-bold text-gray-800 leading-none">
                            {rec?.courseName ?? ""}
                          </td>
                          <td className="py-0.5 px-3 border-r border-gray-900 text-center font-bold leading-none">
                            {rec ? formatNumber(rec.credits, 2) : ""}
                          </td>
                          <td className="py-0.5 px-3 text-center font-black text-gray-900 leading-none">
                            {rec?.grade ?? ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {hiddenCourseCount > 0 && (
                    <div className="text-center text-[8px] font-black uppercase tracking-widest text-red-600">
                      {hiddenCourseCount} course{hiddenCourseCount > 1 ? "s" : ""}{" "}
                      omitted — A4 limit
                    </div>
                  )}

                  {/* Resize Handle — drag to change total table height */}
                  {editorMode && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-3 bg-amber-500/30 hover:bg-amber-500/60 cursor-ns-resize flex items-center justify-center border-t-2 border-amber-500/60 group z-30 select-none"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        startTableRowHeightResize(e);
                      }}
                      title="Drag up/down to resize total table height"
                    >
                      <div className="flex flex-col gap-[2px] items-center">
                        <div className="w-8 h-0.5 bg-amber-600/80 group-hover:bg-amber-800 rounded-full transition-colors" />
                        <div className="w-8 h-0.5 bg-amber-600/80 group-hover:bg-amber-800 rounded-full transition-colors" />
                      </div>
                    </div>
                  )}
                </div>

                {/* BOTTOM SECTION — absolutely anchored to the bottom of the A4 page.
                    Completely independent of the table; dragging/resizing the table
                    has zero effect on these elements. */}
                <div className="absolute bottom-0 left-[8mm] right-[8mm] z-30 flex flex-col pointer-events-none">
                <div
                  className={`border border-gray-200 mt-1 p-1.5 relative z-10 flex text-[9px] font-black pointer-events-auto ${editorOutlineClass("metrics")}`}
                  style={getBlockStyle("metrics")}
                  onClick={() => editorMode && setSelectedBlock("metrics")}
                  onMouseDown={(e) => startBlockDrag("metrics", e)}
                >
                  {/* Left - GPA */}
                  <div className="flex-1 flex flex-col justify-center border-r border-gray-200 px-3 relative min-h-[26px]">
                    <span className="absolute top-0 left-3 text-[7px] text-gray-400 font-sans tracking-widest uppercase font-black">
                      PERFORMANCE METRICS
                    </span>
                    <div className="flex justify-between items-end h-full pt-3">
                      <span className="text-gray-600">
                        Semester GPA:{" "}
                        <span className="text-gray-950 font-black">
                          {currentRecords.length
                            ? (
                                currentRecords.reduce(
                                  (a, b) =>
                                    a +
                                    (b.points ||
                                      (b.score >= 70
                                        ? 4
                                        : b.score >= 60
                                          ? 3
                                          : b.score >= 50
                                            ? 2
                                            : b.score >= 40
                                              ? 1
                                              : 0)),
                                  0,
                                ) / currentRecords.length
                              ).toFixed(2)
                            : "0.00"}
                        </span>
                      </span>
                      <span className="text-gray-600">
                        Cumulative GPA:{" "}
                        <span className="text-[#4B0082] font-black">
                          {allRecords.length
                            ? (
                                allRecords.reduce(
                                  (a, b) =>
                                    a +
                                    (b.points ||
                                      (b.score >= 70
                                        ? 4
                                        : b.score >= 60
                                          ? 3
                                          : b.score >= 50
                                            ? 2
                                            : b.score >= 40
                                              ? 1
                                              : 0)),
                                  0,
                                ) / allRecords.length
                              ).toFixed(2)
                            : "0.00"}
                        </span>
                      </span>
                    </div>
                  </div>
                  {/* Middle - Averages */}
                  <div className="flex-[1.2] flex justify-center items-end border-r border-gray-200 px-3 pb-0.5">
                    <div className="flex gap-6">
                      <span className="text-gray-600">
                        Current Avg:{" "}
                        <span className="text-gray-950 font-black">
                          {stats.current}%
                        </span>
                      </span>
                      <span className="text-gray-600">
                        Cumulative Avg:{" "}
                        <span className="text-[#4B0082] font-black">
                          {stats.cumulative}%
                        </span>
                      </span>
                    </div>
                  </div>
                  {/* Right - Classification */}
                  <div className="flex-1 flex flex-col justify-center items-center px-3 relative min-h-[30px]">
                    <span className="absolute top-0 right-3 text-[7px] text-gray-400 font-sans tracking-widest uppercase font-black text-right w-full">
                      FINAL CLASSIFICATION
                    </span>
                    <div className="h-full flex items-end justify-center w-full pt-4">
                      <span className="text-[#4B0082] text-[11px] font-black uppercase tracking-wider">
                        {parseFloat(stats.cumulative) >= 70
                          ? "DISTINCTION"
                          : parseFloat(stats.cumulative) >= 60
                            ? "CREDIT"
                            : parseFloat(stats.cumulative) >= 50
                              ? "PASS"
                              : "FAIL"}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-1 relative z-10 pointer-events-auto ${editorOutlineClass("recommendation")}`}
                  style={getBlockStyle("recommendation")}
                  onClick={() =>
                    editorMode && setSelectedBlock("recommendation")
                  }
                  onMouseDown={(e) => startBlockDrag("recommendation", e)}
                >
                  <div className="flex items-start gap-4 px-2 pb-1 border-b border-gray-900">
                    <span className="flex-shrink-0 text-[8px] font-black uppercase text-gray-400 tracking-widest pt-1">
                      RECOMMENDATION:
                    </span>
                    <div className="border-l-[3px] border-[#4B0082] pl-3 py-0.5">
                      <p className="uppercase leading-snug text-gray-950 font-serif font-bold text-[9px] tracking-tight">
                        {getAcademicRecommendation()}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`border border-gray-200 px-3 py-0.5 text-[8px] font-bold relative z-10 mt-1 text-center pointer-events-auto ${editorOutlineClass("grading")}`}
                  style={getBlockStyle("grading")}
                  onClick={() => editorMode && setSelectedBlock("grading")}
                  onMouseDown={(e) => startBlockDrag("grading", e)}
                >
                  <span className="underline uppercase text-gray-500 mr-3">
                    GRADING:
                  </span>
                  <span className="opacity-80 tracking-wide">
                    A (70–100%) &nbsp;|&nbsp; B (60–69%) &nbsp;|&nbsp; C
                    (50–59%) &nbsp;|&nbsp; D (40–49%) &nbsp;|&nbsp;{" "}
                    <span className="text-red-500 font-black">F (&lt;40%)</span>
                  </span>
                </div>


                {/* Forensic tracking layer - invisible to naked eye */}
                <div className="relative z-10 h-[2px] overflow-hidden bg-gradient-to-r from-transparent via-gray-100/30 to-transparent">
                  <div className="text-[1px] text-gray-300 opacity-20 whitespace-nowrap tracking-widest font-mono">
                    FORENSIC-ID:{securityData?.contentHash || "PENDING-HASH"}
                    -CHAIN:{securityData?.blockchainAnchor || "PENDING-ANCHOR"}
                  </div>
                </div>

                <div
                  className={`flex justify-between mt-1 relative z-10 mb-0 px-8 pointer-events-auto ${editorOutlineClass("signatures")}`}
                  style={getBlockStyle("signatures")}
                  onClick={() => editorMode && setSelectedBlock("signatures")}
                  onMouseDown={(e) => startBlockDrag("signatures", e)}
                >
                  {/* University Registrar (Primary Authority on Left) */}
                  <div className="flex flex-col items-start w-[32%] relative">
                    <div className="w-full border-b border-gray-900 relative z-10" />
                    <span className="font-serif italic text-[13px] text-gray-900 whitespace-nowrap mt-1 w-full text-left relative z-10">
                      Dr. Joseph Kiai
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest mt-0.5 text-gray-500 w-full text-left relative z-10">
                      UNIVERSITY REGISTRAR
                    </span>
                  </div>

                  {/* Dean of Faculty of Theology (Academic Authority on Right) */}
                  <div className="flex flex-col items-end w-[32%]">
                    <div className="w-full border-b border-gray-900" />
                    <span className="font-serif italic text-[13px] text-gray-900 whitespace-nowrap mt-1">
                      Dr. Lilian Young
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest mt-0.5 text-gray-500">
                      DEAN, FACULTY OF THEOLOGY
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center px-8 mt-0 mb-1 relative z-10 pointer-events-none">
                  {/* LEFT — issuance metadata */}
                  <div
                    className={`w-[32%] flex justify-start pointer-events-auto ${editorOutlineClass("footerMetadata")}`}
                    style={getBlockStyle("footerMetadata")}
                    onClick={() => editorMode && setSelectedBlock("footerMetadata")}
                    onMouseDown={(e) => startBlockDrag("footerMetadata", e)}
                  >
                    <div className="border border-purple-100 bg-purple-50/20 px-3 py-1.5 rounded-none flex flex-col items-center justify-center w-full max-w-[180px] relative z-10">
                      <div className="flex flex-col items-center text-center">
                        <span className="text-gray-400 text-[7px] font-bold uppercase tracking-widest">
                          DATE OF ISSUE:{" "}
                          {securityData?.issuedAt
                            ? new Date(securityData.issuedAt)
                                .toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                                .toUpperCase()
                            : new Date()
                                .toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                                .toUpperCase()}
                        </span>
                        <span className="text-[7px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                          ID:{" "}
                          {securityData?.serialNumber ||
                            `BMI-TR-${selectedStudent.id.toUpperCase()}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CENTRE — physical seal zone (HIDDEN) */}
                  <div
                    className={`flex flex-col items-center justify-center w-[36%] py-0.5 pointer-events-auto opacity-0 pointer-events-none ${editorOutlineClass("footerSeal")}`}
                    style={getBlockStyle("footerSeal")}
                    onClick={() => editorMode && setSelectedBlock("footerSeal")}
                    onMouseDown={(e) => startBlockDrag("footerSeal", e)}
                  >
                    {/* Dashed circle guides the stamp placement during printing - 53mm diameter */}
                    <div
                      className="rounded-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center"
                      style={{ 
                        borderStyle: "dashed", 
                        borderSpacing: "4px",
                        width: '53mm',
                        height: '53mm'
                      }}
                    >
                      <span className="text-[7px] font-bold text-gray-300 uppercase tracking-[0.15em] text-center leading-tight select-none">
                        OFFICIAL
                        <br />
                        SEAL
                        <br />
                        <span className="text-[5px] opacity-60">(53MM)</span>
                      </span>
                    </div>
                  </div>

                  {/* RIGHT — digital validation badge */}
                  <div
                    className={`w-[32%] flex justify-end pointer-events-auto ${editorOutlineClass("footerBadge")}`}
                    style={getBlockStyle("footerBadge")}
                    onClick={() => editorMode && setSelectedBlock("footerBadge")}
                    onMouseDown={(e) => startBlockDrag("footerBadge", e)}
                  >
                    <div className="border border-purple-100 bg-purple-50/20 px-3 py-1.5 rounded-none flex flex-col items-center justify-center w-full max-w-[180px] relative z-10">
                      <div className="flex items-center gap-1">
                        <ShieldCheck size={8} className="text-gray-400" />
                        <span className="text-gray-400 text-[7px] font-bold uppercase tracking-widest">
                          DIGITAL VALIDATION ACTIVE
                        </span>
                      </div>
                      <span className="text-[7px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                        CERTIFIED E-TRANSCRIPT
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom microtext security line */}
                <div
                  className={`absolute bottom-1 left-0 right-0 z-40 ${editorOutlineClass("microBottom")}`}
                  style={getBlockStyle("microBottom")}
                  onClick={() => editorMode && setSelectedBlock("microBottom")}
                  onMouseDown={(e) => startBlockDrag("microBottom", e)}
                >
                  <MicroText
                    text={`OFFICIAL TRANSCRIPT • TAMPER-EVIDENT SECURITY FEATURES • VERIFY AT ${securityData?.verificationUrl || "BMI.EDU/VERIFY"} • BMI UNIVERSITY`}
                  />
                </div>

                {/* end bottom-anchor container */}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* Reset all screen-only container styles */
          body > #root {
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Hide UI elements during print */
          .no-print, 
          header, 
          nav, 
          footer, 
          aside,
          .transcript-zoom-controls,
          .transcript-toolbar { 
            display: none !important; 
          }

          /* Isolate the transcript root for high-fidelity rendering */
          #official-transcript-root {
            display: flex !important;
            flex-direction: column !important;
            visibility: visible !important;
            
            /* Centered positioning to prevent border clipping */
            position: relative !important;
            margin: 0 auto !important;
            
            /* Standard A4 dimensions */
            width: 210mm !important;
            height: 297mm !important;
            
            /* Visual consistency fixes - reduced padding to accommodate borders */
            padding: 7mm !important;
            border: 6px double #f3f4f6 !important;
            background: white !important;
            
            /* Disable any screen-based transformations */
            transform: none !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            z-index: 99999 !important;
          }

          /* High-quality text rendering for print */
          #official-transcript-root * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
            text-rendering: optimizeLegibility !important;
            font-smooth: always !important;
          }
          
          /* Vector-quality image and SVG rendering */
          #official-transcript-root img,
          #official-transcript-root svg,
          #official-transcript-root canvas {
            image-rendering: -webkit-optimize-contrast !important;
            image-rendering: crisp-edges !important;
            shape-rendering: geometricPrecision !important;
          }
          
          /* Prevent subpixel rendering artifacts */
          #official-transcript-root * {
            transform: translateZ(0);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
          }
        }

        #official-transcript-root {
          user-select: none;
          -webkit-user-select: none;
          box-sizing: border-box;
          /* High-quality rendering for screen preview */
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        
        /* High-quality image rendering for screen */
        #official-transcript-root img,
        #official-transcript-root svg {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          shape-rendering: geometricPrecision;
        }

        /* Holographic animation - simulates color-shifting security ink */
        @keyframes holographic-shift {
          0% {
            background-position: 0% 50%;
            opacity: 0.3;
          }
          50% {
            background-position: 100% 50%;
            opacity: 0.5;
          }
          100% {
            background-position: 0% 50%;
            opacity: 0.3;
          }
        }

        /* Copy protection - text becomes visible on photocopy */
        @media print {
          #voidPantograph text {
            opacity: 0.8 !important;
          }
        }

        /* Enhanced security for screen display */
        @media screen {
          #official-transcript-root::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
            background-size: 200% 200%;
            animation: shimmer 3s ease-in-out infinite;
            pointer-events: none;
            z-index: 100;
            mix-blend-mode: overlay;
          }
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
};





