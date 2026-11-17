import React, { useState } from "react";
import { 
  Search, 
  Bell, 
  Sparkles, 
  Sun, 
  Moon, 
  User, 
  LogOut, 
  ChevronDown, 
  Menu,
  GraduationCap
} from '../shims/lucide-react';
import { useAuthStore } from "../stores/authStore";
import { useUIStore } from "../stores/uiStore";
import ProfileModal from "./ProfileModal";

interface TopHeaderProps {
  onOpenSidebar: () => void;
  isSidebarOpen: boolean;
}

const TopHeader: React.FC<TopHeaderProps> = ({ onOpenSidebar, isSidebarOpen }) => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { 
    theme, 
    toggleTheme, 
    openAIModal, 
    openNotificationCenter
  } = useUIStore();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "admin":
        return <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Executive Admin</span>;
      case "registrar":
        return <span className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Registrar</span>;
      case "finance":
      case "bursar":
        return <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Bursar / Finance</span>;
      case "faculty":
        return <span className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Faculty Chair</span>;
      case "hr":
        return <span className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">HR Director</span>;
      case "admissions":
        return <span className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Admissions</span>;
      default:
        return <span className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Staff</span>;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800 px-4 lg:px-6 py-2.5 flex items-center justify-between transition-colors">
        {/* Left Side: Mobile Menu + Term Badge & Quick Search */}
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Toggle Button */}
          <button
            onClick={onOpenSidebar}
            className={`lg:hidden p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all ${isSidebarOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
            aria-label="Open Sidebar Menu"
          >
            <Menu size={18} />
          </button>

          {/* Academic Term Indicator */}
          <div className="hidden sm:flex items-center gap-2 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/50 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-900 dark:text-purple-200">
            <GraduationCap className="w-4 h-4 text-[#7C3AED]" />
            <span>2026/2027 Academic Year</span>
            <span className="text-purple-400 dark:text-purple-600">•</span>
            <span className="text-purple-700 dark:text-purple-300">Term II</span>
          </div>

          {/* Quick Search Bar */}
          <div className="relative hidden md:block w-64 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students, courses, staff... (Cmd+K)"
              className="w-full pl-9 pr-4 py-1.5 bg-gray-100/80 dark:bg-gray-800/80 border border-transparent focus:border-[#7C3AED] dark:focus:border-[#FFD700] rounded-xl text-xs text-gray-800 dark:text-gray-200 focus:outline-none transition-all placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Right Side: Quick Action Bar & User Profile Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* AI Assistant Button */}
          <button
            onClick={openAIModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all"
            title="Ask AI Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin-slow" />
            <span className="hidden sm:inline">AI Copilot</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
            title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {theme === "dark" ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-purple-700" />}
          </button>

          {/* Notifications Bell */}
          <button
            onClick={openNotificationCenter}
            className="relative p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
          </button>

          {/* User Profile Pill & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#4B0082] to-[#7C3AED] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-100 line-clamp-1">{user?.name || "System User"}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">{user?.email || "user@bmi.edu"}</span>
              </div>
              <div className="hidden sm:inline-flex">
                {getRoleBadge(user?.role)}
              </div>
              <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
            </button>

            {/* Profile Dropdown Menu */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl py-2 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                  <p className="font-bold text-gray-900 dark:text-white truncate">{user?.name}</p>
                  <p className="text-gray-500 dark:text-gray-400 truncate text-[11px] mt-0.5">{user?.email}</p>
                </div>

                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    setShowProfileModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors"
                >
                  <User size={15} />
                  <span>My Profile & Settings</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    openAIModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors"
                >
                  <Sparkles size={15} className="text-amber-500" />
                  <span>AI Assistant Hub</span>
                </button>

                <div className="border-t border-gray-100 dark:border-gray-800 my-1" />

                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium transition-colors"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
};

export default TopHeader;
