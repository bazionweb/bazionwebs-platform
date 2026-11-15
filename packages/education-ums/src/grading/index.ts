/**
 * BMI UMS - University Grading System
 * Public barrel export for the grading system module.
 *
 * Domain models are intentionally NOT re-exported here to avoid name conflicts
 * between model factory functions (e.g. createGrade in models/Grade.ts) and
 * API service functions with the same name (services/GradeAPIService.ts).
 * Import models directly from './models' when needed.
 */

// Core types (shared interfaces & enums)
export * from "./types";

// Services (API operations)
export * from "./services";

// Calculators (GPA, grade conversion)
export * from "./calculators";

// Engines (analytics, academic standing)
export * from "./engines";

// Repositories (data access stubs)
export * from "./repositories";









