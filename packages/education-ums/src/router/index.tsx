/**
 * BMI UMS - React Router Configuration
 * Replaces the switch/case ViewRenderer with proper URL-based routing.
 * Each view gets its own route, enabling:
 * - Browser back/forward navigation
 * - Deep linking (e.g., /students goes directly to Students view)
 * - URL-based navigation state
 * - SEO-friendly URLs for public verification pages
 */
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from '../shims/react-router-dom';
import { useAuthStore } from "../stores/authStore";
import { ScrollToTop } from "../components/ScrollToTop";

// Lazy-loaded page components for code splitting
const Dashboard = lazy(() => import("../components/Dashboard"));
const Admissions = lazy(() => import("../components/Admissions"));
const Students = lazy(() => import("../components/Students"));
const Staff = lazy(() => import("../components/Staff"));
const Attendance = lazy(() => import("../components/Attendance"));
const Finance = lazy(() => import("../components/Finance"));
const Courses = lazy(() => import("../components/Courses"));
const Grades = lazy(() => import("../components/Grades"));
const Transcripts = lazy(() =>
  import("../components/Transcripts").then((m) => ({ default: m.Transcripts })),
);
const Certificates = lazy(() => import("../components/Certificates"));
const Library = lazy(() =>
  import("../components/Library").then((m) => ({ default: m.Library })),
);
const Hostels = lazy(() => import("../components/Hostels"));
const Medical = lazy(() =>
  import("../components/Medical").then((m) => ({ default: m.Medical })),
);
const Inventory = lazy(() => import("../components/Inventory"));
const Alumni = lazy(() => import("../components/Alumni"));
const Communications = lazy(() => import("../components/Communications"));
const Visitors = lazy(() => import("../components/Visitors"));
const Reports = lazy(() => import("../components/Reports"));
const Settings = lazy(() => import("../components/Settings"));
const StudentPortal = lazy(() => import("../components/StudentPortal"));
const FacultyPortal = lazy(() => import("../components/FacultyPortal"));
const Programs = lazy(() => import("../components/Programs"));
const ProgramDetail = lazy(() => import("../components/ProgramDetail"));
const Timetable = lazy(() => import("../components/Timetable"));
const Terms = lazy(() => import("../components/Terms"));
const RubricBuilder = lazy(() => import("../components/grading/RubricBuilder"));
const SystemHealth = lazy(() => import("../components/SystemHealth"));
const AdminDocuments = lazy(() => import("../components/AdminDocuments"));

// Page-level loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading module...</p>
      </div>
    </div>
  );
}

/**
 * RoleGuard — redirects to /dashboard when the signed-in user's role
 * does not match the required role.  Always passes when role is undefined
 * (i.e. admin / staff routes that are open to all authenticated users).
 */
function RoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);

  // Superadmin & Admin bypass all module restrictions
  if (user?.role === "admin" || user?.role === "superadmin") return <>{children}</>;

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

/**
 * AppRoutes - authenticated route tree
 * All routes require the user to be logged in (handled by parent AppLayout).
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Portals */}
        <Route
          path="/student"
          element={
            <RoleGuard allowedRoles={["student"]}>
              <StudentPortal />
            </RoleGuard>
          }
        />
        <Route
          path="/faculty"
          element={
            <RoleGuard allowedRoles={["faculty"]}>
              <FacultyPortal />
            </RoleGuard>
          }
        />

        {/* Standard Modules */}
        <Route
          path="/admissions"
          element={
            <RoleGuard allowedRoles={["registrar", "admissions", "staff"]}>
              <Admissions />
            </RoleGuard>
          }
        />
        <Route path="/students" element={<Students />} />
        <Route
          path="/staff"
          element={
            <RoleGuard allowedRoles={["registrar", "hr", "finance", "staff"]}>
              <Staff />
            </RoleGuard>
          }
        />
        <Route
          path="/attendance"
          element={
            <RoleGuard allowedRoles={["registrar", "faculty", "hr", "staff"]}>
              <Attendance />
            </RoleGuard>
          }
        />
        <Route
          path="/finance"
          element={
            <RoleGuard allowedRoles={["registrar", "finance", "bursar", "hr"]}>
              <Finance />
            </RoleGuard>
          }
        />
        <Route path="/courses" element={<Courses />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/timetable" element={<Timetable />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/programs/:id" element={<ProgramDetail />} />
        <Route path="/exams" element={<Navigate to="/grades" replace />} />
        <Route
          path="/grades"
          element={
            <RoleGuard allowedRoles={["registrar", "faculty"]}>
              <Grades />
            </RoleGuard>
          }
        />
        <Route
          path="/rubrics"
          element={
            <RoleGuard allowedRoles={["registrar", "faculty"]}>
              <RubricBuilder />
            </RoleGuard>
          }
        />
        <Route
          path="/transcripts"
          element={
            <RoleGuard allowedRoles={["registrar"]}>
              <Transcripts />
            </RoleGuard>
          }
        />
        <Route
          path="/certificates"
          element={
            <RoleGuard allowedRoles={["registrar"]}>
              <Certificates />
            </RoleGuard>
          }
        />
        <Route path="/library" element={<Library />} />
        <Route
          path="/hostels"
          element={
            <RoleGuard allowedRoles={["staff", "facilities"]}>
              <Hostels />
            </RoleGuard>
          }
        />
        <Route path="/medical" element={<Medical />} />
        <Route
          path="/inventory"
          element={
            <RoleGuard allowedRoles={["staff", "facilities"]}>
              <Inventory />
            </RoleGuard>
          }
        />
        <Route
          path="/alumni"
          element={
            <RoleGuard allowedRoles={["registrar", "admissions"]}>
              <Alumni />
            </RoleGuard>
          }
        />
        <Route
          path="/communications"
          element={
            <RoleGuard allowedRoles={["registrar", "admissions", "finance", "hr", "staff"]}>
              <Communications />
            </RoleGuard>
          }
        />
        <Route
          path="/visitors"
          element={
            <RoleGuard allowedRoles={["staff", "facilities"]}>
              <Visitors />
            </RoleGuard>
          }
        />
        <Route
          path="/reports"
          element={
            <RoleGuard allowedRoles={["registrar", "finance", "hr", "admissions"]}>
              <Reports />
            </RoleGuard>
          }
        />
        <Route
          path="/settings"
          element={
            <RoleGuard allowedRoles={["registrar", "faculty", "staff", "finance", "hr", "admissions"]}>
              <Settings />
            </RoleGuard>
          }
        />
        <Route
          path="/documents"
          element={
            <RoleGuard allowedRoles={["registrar", "admissions", "staff"]}>
              <AdminDocuments />
            </RoleGuard>
          }
        />
        <Route
          path="/diagnostics"
          element={
            <RoleGuard allowedRoles={[]}>
              <SystemHealth />
            </RoleGuard>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}









