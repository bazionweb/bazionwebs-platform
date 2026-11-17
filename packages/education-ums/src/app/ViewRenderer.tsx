/**
 * BMI UMS - ViewRenderer (Compatibility Bridge)
 *
 * IMPORTANT: This component is now DEPRECATED in favor of React Router.
 * It remains as a compatibility bridge for components that still expect
 * ViewRendererProps during the migration period.
 *
 * New pages should:
 * 1. Import data directly from Zustand stores (useDataStore, useAuthStore, useUIStore)
 * 2. Use react-router-dom's useNavigate for navigation
 * 3. Not rely on prop drilling from ViewRenderer
 *
 * Migration checklist:
 * - [x] Dashboard - migrated to Zustand + react-router
 * - [ ] Students - still uses ViewRendererProps
 * - [ ] Staff - still uses ViewRendererProps
 * - [ ] All other components - still use ViewRendererProps
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from '../shims/react-router-dom';
import Dashboard from "../components/Dashboard";
import Students from "../components/Students";
import Staff from "../components/Staff";
import Attendance from "../components/Attendance";
import Finance from "../components/Finance";
import Courses from "../components/Courses";
import Terms from "../components/Terms";
import Exams from "../components/Exams";
import Grades from "../components/Grades";
import { Transcripts } from "../components/Transcripts";
import Certificates from "../components/Certificates";
import { Library } from "../components/Library";
import Hostels from "../components/Hostels";
import { Medical } from "../components/Medical";
import Inventory from "../components/Inventory";
import Alumni from "../components/Alumni";
import Communications from "../components/Communications";
import Visitors from "../components/Visitors";
import Reports from "../components/Reports";
import Settings from "../components/Settings";
import VerificationPage from "../components/VerificationPage";

import type {
  Course,
  LibraryItem,
  Student,
  StaffMember,
  Transaction,
} from "../types";
import type { SetStateAction } from "react";
import { useUIStore } from "../stores/uiStore";

type ViewKey =
  | "dashboard"
  | "students"
  | "staff"
  | "attendance"
  | "finance"
  | "courses"
  | "exams"
  | "grades"
  | "transcripts"
  | "certificates"
  | "verify"
  | "library"
  | "hostels"
  | "medical"
  | "inventory"
  | "alumni"
  | "sms"
  | "visitors"
  | "reports"
  | "ai"
  | "settings"
  | string;

export interface ViewRendererProps {
  currentView: ViewKey;
  theme: "light" | "dark" | string;
  logo: string;
  stats: {
    students: number;
    admissions: number;
    tuition: number;
    events: number;
  };

  students: Student[];
  setStudents: React.Dispatch<SetStateAction<Student[]>>;
  staff: StaffMember[];
  setStaff: React.Dispatch<SetStateAction<StaffMember[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<SetStateAction<Transaction[]>>;
  courses: Course[];
  setCourses: React.Dispatch<SetStateAction<Course[]>>;
  library: LibraryItem[];
  setLibrary: React.Dispatch<SetStateAction<LibraryItem[]>>;

  onOpenAIModal: () => void;
  onNavigate: (view: ViewKey) => void;
  onUpdateLogo: (logo: string) => void;
  onUpdateTheme: (theme: string) => void;

  onAddStudent: (student: Student) => void;
  onAddTransaction: (amt: number) => void;
}

/**
 * ViewRendererCompat - bridges old switch/case rendering with Zustand stores.
 * Components that have been migrated to use Zustand stores directly
 * no longer need props passed through this layer.
 */
export default function ViewRenderer(props: ViewRendererProps) {
  const { currentView } = props;

  const { logo } = useUIStore();
  const openAIModal = useUIStore((s) => s.openAIModal);
  const navigate = useNavigate();

// //   const _onNavigate = (view: ViewKey) => {
// //     if (view === "ai") {
// //       openAIModal();
// //     } else if (view === "sms") {
// //       navigate("/communications");
// //     } else {
// //       navigate(`/${view}`);
// //     }
// //   };

  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    if (pendingAction === "ai") {
      openAIModal();
      navigate("/dashboard");
      setPendingAction(null);
    }
  }, [pendingAction, openAIModal, navigate]);

  switch (currentView) {
    case "dashboard":
      return <Dashboard />;
    case "students":
      return <Students />;
    case "staff":
      return <Staff />;
    case "attendance":
      return <Attendance />;
    case "finance":
      return <Finance />;
    case "courses":
      return <Courses />;
    case "terms":
      return <Terms />;
    case "exams":
      return <Exams />;
    case "grades":
      return <Grades />;
    case "transcripts":
      return <Transcripts logo={logo} />;
    case "certificates":
      return <Certificates />;
    case "verify":
      return <VerificationPage logo={logo} />;
    case "library":
      return <Library />;
    case "hostels":
      return <Hostels />;
    case "medical":
      return <Medical />;
    case "inventory":
      return <Inventory />;
    case "alumni":
      return <Alumni />;
    case "sms":
      return <Communications />;
    case "visitors":
      return <Visitors />;
    case "reports":
      return <Reports />;
    case "ai":
      setPendingAction("ai");
      return <Dashboard />;
    case "settings":
      return <Settings />;
    default:
      return <Dashboard />;
  }
}









