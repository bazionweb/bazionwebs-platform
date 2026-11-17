/**
 * ExamsPanel — re-exports the Exams component for use inside the unified
 * Assessments & Grades page. Keeping this thin wrapper ensures Exams.tsx
 * remains a standalone component with its own state, while Grades.tsx can
 * embed it as a tab without circular dependencies.
 */
export { default } from "./Exams";
