import React, { useCallback, useRef, useEffect } from "react";
import { useNavigate, useLocation } from '../shims/react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Calendar,
  CreditCard,
  MonitorPlay,
  MessageSquare,
  FileBarChart,
  Settings,
  Bot,
  LogOut,
  Briefcase,
  Book,
  Home,
  FileSpreadsheet,
  ShieldCheck,
  Stethoscope,
  Package,
  Award,
  FileText,
  Scroll,
  X,
  GraduationCap,
  Activity,
  ClipboardList,
  ChevronDown,
} from '../shims/lucide-react';
import { NavItem } from "../types";
import { useUIStore } from "../stores/uiStore";
import { useAuthStore } from "../stores/authStore";
import { useTranslation } from '../shims/react-i18next';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  onLogout: () => void;
  logo: string;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  items: NavItem[];
}

const viewToRoute: Record<string, string> = {
  student: "/student",
  faculty: "/faculty",
  dashboard: "/dashboard",
  students: "/students",
  staff: "/staff",
  attendance: "/attendance",
  finance: "/finance",
  courses: "/courses",
  terms: "/terms",
  timetable: "/timetable",
  programs: "/programs",
  exams: "/exams",
  grades: "/grades",
  rubrics: "/rubrics",
  transcripts: "/transcripts",
  certificates: "/certificates",
  library: "/library",
  hostels: "/hostels",
  medical: "/medical",
  inventory: "/inventory",
  alumni: "/alumni",
  sms: "/communications",
  visitors: "/visitors",
  reports: "/reports",
  settings: "/settings",
  diagnostics: "/diagnostics",
};

// Accessible keyboard handler for group toggles
function useKeyboardNav() {
  const handleGroupKeyDown = useCallback(
    (e: React.KeyboardEvent, toggle: () => void, close: () => void) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [],
  );
  return { handleGroupKeyDown };
}

const Sidebar: React.FC<SidebarProps> = ({
  onLogout,
  logo,
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const openAIModal = useUIStore((s) => s.openAIModal);
  const expandedGroups = useUIStore((s) => s.expandedGroups);
  const toggleGroup = useUIStore((s) => s.toggleGroup);
  const user = useAuthStore((s) => s.user);
  const { handleGroupKeyDown } = useKeyboardNav();
  const activeGroupRef = useRef<HTMLButtonElement>(null);

  // Role-specific portal items shown only for matching roles
  const roleItems: NavItem[] =
    user?.role === "faculty"
      ? [{ id: "faculty", label: "Faculty Portal", icon: Briefcase }]
      : [];

  // Define navigation groups
  const navGroups: NavGroup[] = [
    {
      id: "quick_access",
      label: "Dashboard",
      icon: LayoutDashboard,
      items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      id: "student_mgmt",
      label: "Student Management",
      icon: Users,
      items: [
        { id: "admissions", label: "Admissions", icon: ClipboardList },
        { id: "documents", label: "Documents", icon: FileText },
        { id: "students", label: "Students", icon: Users },
        { id: "alumni", label: "Alumni Registry", icon: Award },
      ],
    },
    {
      id: "academic",
      label: "Academic",
      icon: MonitorPlay,
      items: [
        { id: "programs", label: `Degree ${t("academic.programs")}`, icon: GraduationCap },
        { id: "courses", label: "Courses", icon: MonitorPlay },
        { id: "terms", label: "Academic Terms", icon: Calendar },
        { id: "grades", label: "Assessments & Grades", icon: FileSpreadsheet },
        { id: "rubrics", label: "Marking Rubrics", icon: FileText },
        { id: "transcripts", label: "Transcripts", icon: FileText },
        { id: "certificates", label: "Certificates", icon: Scroll },
      ],
    },
    {
      id: "faculty_staff",
      label: "Faculty & Staff",
      icon: Briefcase,
      items: [
        { id: "staff", label: "Staff & Faculty", icon: Briefcase },
      ],
    },
    {
      id: "operations",
      label: "Operations",
      icon: CalendarCheck,
      items: [
        { id: "attendance", label: "Attendance", icon: CalendarCheck },
        { id: "timetable", label: "Timetable", icon: Calendar },
        { id: "finance", label: "Finance", icon: CreditCard },
      ],
    },
    {
      id: "facilities",
      label: "Facilities",
      icon: Home,
      items: [
        { id: "hostels", label: "Hostels", icon: Home },
        { id: "library", label: "Library", icon: Book },
        { id: "medical", label: "Health Center", icon: Stethoscope },
        { id: "inventory", label: "Inventory", icon: Package },
        { id: "visitors", label: "Visitors", icon: ShieldCheck },
      ],
    },
    {
      id: "system",
      label: "System",
      icon: Settings,
      items: [
        { id: "sms", label: "Communications", icon: MessageSquare },
        { id: "reports", label: "Reports", icon: FileBarChart },
        { id: "ai", label: "AI Assistant", icon: Bot },
        { id: "settings", label: "Settings", icon: Settings },
        { id: "diagnostics", label: "System Health", icon: Activity },
      ],
    },
  ];

  // Filter groups and items based on user role
  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (user?.role === "admin") return true;
        if (["ai", "settings"].includes(item.id)) return true;

        switch (user?.role) {
          case "registrar":
            return [
              "dashboard",
              "admissions",
              "documents",
              "students",
              "staff",
              "attendance",
              "timetable",
              "courses",
              "programs",
              "grades",
              "rubrics",
              "transcripts",
              "certificates",
              "reports",
              "alumni",
              "sms",
            ].includes(item.id);
          case "finance":
          case "bursar":
            return [
              "dashboard",
              "finance",
              "students",
              "staff",
              "reports",
              "sms",
            ].includes(item.id);
          case "faculty":
            return [
              "dashboard",
              "students",
              "attendance",
              "timetable",
              "courses",
              "programs",
              "grades",
              "rubrics",
              "library",
            ].includes(item.id);
          case "hr":
            return [
              "dashboard",
              "staff",
              "attendance",
              "finance",
              "reports",
              "sms",
            ].includes(item.id);
          case "admissions":
            return [
              "dashboard",
              "admissions",
              "documents",
              "students",
              "alumni",
              "reports",
              "sms",
            ].includes(item.id);
          case "facilities":
          case "staff":
            return [
              "dashboard",
              "hostels",
              "library",
              "medical",
              "inventory",
              "visitors",
              "timetable",
              "sms",
              "documents",
            ].includes(item.id);
          case "viewer":
            return ["dashboard", "students", "courses", "library"].includes(item.id);
          default:
            return ["dashboard"].includes(item.id);
        }
      }),
    }))
    .filter((group) => group.items.length > 0);

  // Auto-expand the group containing the active item
  const currentPath = location.pathname;
  const getActiveView = (itemId: string): boolean => {
    if (itemId === "dashboard") return currentPath === "/" || currentPath === "/dashboard";
    if (itemId === "sms") return currentPath === "/communications";
    return currentPath === `/${itemId}`;
  };

  // Auto-expand active item's group on mount and route change
  useEffect(() => {
    for (const group of filteredGroups) {
      for (const item of group.items) {
        if (getActiveView(item.id)) {
          useUIStore.getState().expandGroup(group.id);
          break;
        }
      }
    }
  }, [currentPath, filteredGroups]);

  const handleNavigate = (viewId: string) => {
    if (viewId === "ai") {
      openAIModal();
    } else {
      const route = viewToRoute[viewId] || `/${viewId}`;
      navigate(route);
    }
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen bg-[#0a0015] border-r border-purple-900/30 text-slate-200 flex flex-col shadow-2xl z-50 transition-all duration-300 ease-out ${
          isCollapsed ? "w-16" : "w-64"
        } ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className={`p-4 flex ${isCollapsed ? "justify-center" : "justify-between"} items-center border-b border-purple-900/30 bg-purple-950/20`}>
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 relative p-1 bg-white rounded-xl border border-[#FFD700]/50 shadow-md flex items-center justify-center">
                <img
                  src={logo}
                  alt="BMI University"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                  BMI University
                </h1>
                <span className="text-[9px] font-bold text-[#FFD700] uppercase tracking-wider block">Enterprise UMS</span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="w-8 h-8 relative p-1 bg-white rounded-xl border border-[#FFD700]/50 shadow-md">
              <img
                src={logo}
                alt="BMI"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-purple-900/40 rounded-xl transition-colors"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto py-3 px-2 space-y-2 no-scrollbar"
          aria-label="Main navigation"
        >
          {/* Role-specific portal items */}
          {roleItems.map((item) => {
            const Icon = item.icon;
            const isActive = getActiveView(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative text-left ${
                  isActive
                    ? "bg-gradient-to-r from-[#6b21a8] to-[#4c1d95] text-white shadow-lg border-l-4 border-[#FFD700]"
                    : "text-slate-300 hover:bg-purple-950/40 hover:text-white"
                }`}
                title={isCollapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  size={18}
                  className={`flex-shrink-0 ${isActive ? "text-[#FFD700]" : "text-slate-400 group-hover:text-white"}`}
                />
                {!isCollapsed && (
                  <span className="text-xs font-bold truncate">{item.label}</span>
                )}
              </button>
            );
          })}

          {/* Role divider */}
          {roleItems.length > 0 && !isCollapsed && (
            <div className="py-1 px-3">
              <div className="border-t border-purple-900/30" />
            </div>
          )}

          {/* Navigation groups */}
          {filteredGroups.map((group) => {
            const GroupIcon = group.icon as React.ElementType;
            const isExpanded = expandedGroups.includes(group.id);
            const hasActiveChild = group.items.some((item) => getActiveView(item.id));

            const handleGroupClick = () => {
              if (isCollapsed) {
                if (group.items.length === 1) {
                  handleNavigate(group.items[0].id);
                } else {
                  onToggleCollapse();
                  useUIStore.getState().expandGroup(group.id);
                }
              } else {
                toggleGroup(group.id);
              }
            };

            return (
              <div key={group.id} className="relative group/navgroup space-y-1">
                {/* Group header */}
                <button
                  ref={activeGroupRef}
                  onClick={handleGroupClick}
                  onKeyDown={(e) =>
                    handleGroupKeyDown(
                      e,
                      handleGroupClick,
                      () => {
                        if (isExpanded) toggleGroup(group.id);
                      },
                    )
                  }
                  className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all duration-200 text-left ${
                    isCollapsed
                      ? `justify-center ${hasActiveChild ? "bg-purple-900/50 text-[#FFD700] border-l-2 border-[#FFD700]" : "text-slate-400 hover:bg-purple-950/40 hover:text-white"}`
                      : "text-slate-400 hover:bg-purple-950/40 hover:text-white"
                  }`}
                  title={isCollapsed ? group.label : undefined}
                  aria-expanded={isExpanded}
                  aria-label={`${group.label} section`}
                >
                  <GroupIcon
                    size={16}
                    className={`flex-shrink-0 ${hasActiveChild ? "text-[#FFD700]" : "text-purple-400"}`}
                  />
                  {!isCollapsed && (
                    <>
                      <span className="text-[10px] font-black text-purple-300/70 uppercase tracking-widest flex-1 truncate">
                        {group.label}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 text-slate-400 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                      />
                    </>
                  )}
                </button>

                {/* Hover Flyout Submenu (for Collapsed Sidebar) */}
                {isCollapsed && (
                  <div className="absolute left-full top-0 ml-2 hidden group-hover/navgroup:flex flex-col bg-[#0d021f] border border-purple-900/60 rounded-xl shadow-2xl z-50 min-w-[190px] p-2 backdrop-blur-xl animate-fade-in">
                    <div className="px-2 py-1 text-[10px] font-black text-[#FFD700] uppercase tracking-widest border-b border-purple-900/40 mb-1.5 flex items-center justify-between">
                      <span>{group.label}</span>
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = getActiveView(item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleNavigate(item.id)}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 text-left ${
                              isActive
                                ? "bg-purple-900/60 text-white font-bold border-l-2 border-[#FFD700]"
                                : "text-slate-300 hover:bg-purple-950/80 hover:text-white"
                            }`}
                          >
                            <Icon size={14} className={isActive ? "text-[#FFD700]" : "text-slate-400"} />
                            <span className="text-xs truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Submenu items (for Expanded Sidebar) */}
                {!isCollapsed && (
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="ml-3 pl-2.5 border-l border-purple-900/40 space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = getActiveView(item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleNavigate(item.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 group text-left ${
                              isActive
                                ? "bg-gradient-to-r from-[#6b21a8] to-[#581c87] text-white font-bold shadow-md border-l-2 border-[#FFD700]"
                                : "text-slate-300 hover:bg-purple-950/40 hover:text-white font-medium"
                            }`}
                            aria-current={isActive ? "page" : undefined}
                          >
                            <Icon
                              size={15}
                              className={`flex-shrink-0 ${isActive ? "text-[#FFD700]" : "text-slate-400 group-hover:text-white"}`}
                            />
                            <span className="text-xs truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`p-3 border-t border-purple-900/30 bg-purple-950/20 space-y-2 ${isCollapsed ? "" : "px-4"}`}>
          {/* Collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex w-full items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:bg-purple-900/30 hover:text-white transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <LayoutDashboard size={18} className="flex-shrink-0" />
            {!isCollapsed && <span className="text-xs font-semibold">Collapse Navigation</span>}
          </button>

          {/* User Card */}
          {!isCollapsed && user && (
            <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-900/40 text-xs text-slate-300 flex items-center justify-between gap-2">
              <div className="truncate">
                <div className="truncate font-bold text-white">{user.name}</div>
                <div className="truncate text-[10px] text-purple-300/70">{user.email}</div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}

          {/* Collapse state Logout */}
          {isCollapsed && (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              title="Log Out"
            >
              <LogOut size={18} />
            </button>
          )}

          {/* Build marker — identifies the running deployment (see vite.config.ts) */}
          {!isCollapsed && (
            <div
              className="text-center text-[9px] text-purple-400/40 font-mono select-none"
              title={`Deployed UMS build ${__BMI_BUILD_SHA__}`}
            >
              build {__BMI_BUILD_SHA__}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
