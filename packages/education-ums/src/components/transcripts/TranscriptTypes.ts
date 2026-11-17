import { Student, Course } from '../../types';

export interface TranscriptsProps {
  students?: Student[];
  courses?: Course[];
  logo?: string;
}

export interface PerformanceRecord {
  courseCode: string;
  courseName: string;
  credits: number;
  score: number;
  grade: string;
  points: number;
  term: string;
}

export type EditableBlockKey =
  | "microTop"
  | "headerTitle"
  | "studentName"
  | "studentMeta"
  | "table"
  | "metrics"
  | "recommendation"
  | "grading"
  | "signatures"
  | "footerMetadata"
  | "footerSeal"
  | "footerBadge"
  | "microBottom";

export type BlockPosition = {
  x: number;
  y: number;
  align?: "left" | "center" | "right";
};
export type TranscriptTemplateLayout = {
  rows: number;
  tableRowMm?: number;
  tableHeightMm?: number;   // total table height; rows fill this evenly
  blocks: Record<EditableBlockKey, BlockPosition>;
};

export const TRANSCRIPT_LAYOUT_STORAGE_KEY = "bmi_transcript_template_layout_v1";

/**
 * ============================================================================
 * PRODUCTION LAYOUT LOCK (DO NOT MODIFY MANUALLY)
 * ============================================================================
 * The coordinates below are calibrated for official A4 transcript standards.
 * To adjust the layout:
 * 1. Set TRANSCRIPT_TEMPLATE_LOCKED = false
 * 2. Use the in-app "Edit Template" mode to drag elements
 * 3. Copy the resulting JSON and update the DEFAULT_TRANSCRIPT_TEMPLATE_LAYOUT
 * ============================================================================
 */
export const TRANSCRIPT_TEMPLATE_LOCKED = true;

export const DEFAULT_TRANSCRIPT_TEMPLATE_LAYOUT: TranscriptTemplateLayout = {
  "rows": 25,
  "tableRowMm": 5.4,
  "tableHeightMm": 143,
  "blocks": {
    "microTop": {
      "x": 0,
      "y": -20,
      "align": "center"
    },
    "headerTitle": {
      "x": 0,
      "y": -15,
      "align": "center"
    },
    "studentName": {
      "x": 0,
      "y": -10,
      "align": "center"
    },
    "studentMeta": {
      "x": 0,
      "y": -5,
      "align": "left"
    },
    "table": {
      "x": 0,
      "y": 225,
      "align": "left"
    },
    "metrics": {
      "x": 0,
      "y": 60,
      "align": "left"
    },
    "recommendation": {
      "x": 0,
      "y": 65,
      "align": "left"
    },
    "grading": {
      "x": 1,
      "y": 70,
      "align": "center"
    },
    "signatures": {
      "x": 0,
      "y": 122,
      "align": "left"
    },
    "footerMetadata": {
      "x": -7,
      "y": 58,
      "align": "left"
    },
    "footerSeal": {
      "x": 0,
      "y": 10,
      "align": "center"
    },
    "footerBadge": {
      "x": 11,
      "y": 64,
      "align": "right"
    },
    "microBottom": {
      "x": 0,
      "y": 5,
      "align": "center"
    }
  }
};