import React from "react";

export interface LucideProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

export type LucideIcon = React.FC<LucideProps>;

const ICON_PATHS: Record<string, React.ReactNode> = {
  Activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  AlertCircle: <><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></>,
  AlertTriangle: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  ArrowLeft: <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
  ArrowRight: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  ArrowUpRight: <><path d="M7 7h10v10" /><path d="M7 17 17 7" /></>,
  Bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  BookOpen: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  Calendar: <><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></>,
  Check: <polyline points="20 6 9 17 4 12" />,
  CheckCircle: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
  CheckCircle2: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  ChevronDown: <path d="m6 9 6 6 6-6" />,
  ChevronLeft: <path d="m15 18-6-6 6-6" />,
  ChevronRight: <path d="m9 18 6-6-6-6" />,
  Clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  Copy: <><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>,
  DollarSign: <><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
  Download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></>,
  Edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  Eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  EyeOff: <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></>,
  FileText: <><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /></>,
  Filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  GraduationCap: <><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></>,
  Home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  LayoutDashboard: <><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>,
  Loader2: <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
  Lock: <><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  LogOut: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></>,
  Mail: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  Menu: <><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></>,
  Moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  Plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  Printer: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></>,
  QrCode: <><rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /></>,
  RefreshCw: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></>,
  Save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>,
  Search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  Send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  Settings: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>,
  Shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />,
  ShieldAlert: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="M12 8v4" /><path d="M12 16h.01" /></>,
  ShieldCheck: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></>,
  Sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>,
  Trash2: <><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></>,
  Upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></>,
  User: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  Users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  X: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  XCircle: <><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></>,
};

function makeIcon(name: string): LucideIcon {
  const paths = ICON_PATHS[name] ?? (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="12" cy="12" r="3" />
    </>
  );
  const Component: LucideIcon = ({ size = 20, strokeWidth = 2, className = "", ...props }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {paths}
    </svg>
  );
  Component.displayName = name;
  return Component;
}

export const Activity = makeIcon("Activity");
export const AlertCircle = makeIcon("AlertCircle");
export const AlertTriangle = makeIcon("AlertTriangle");
export const Archive = makeIcon("Archive");
export const ArrowLeft = makeIcon("ArrowLeft");
export const ArrowRight = makeIcon("ArrowRight");
export const ArrowUpRight = makeIcon("ArrowUpRight");
export const Award = makeIcon("Award");
export const BarChart = makeIcon("BarChart");
export const BarChart2 = makeIcon("BarChart2");
export const BarChart3 = makeIcon("BarChart3");
export const Bed = makeIcon("Bed");
export const Bell = makeIcon("Bell");
export const Book = makeIcon("Book");
export const BookMarked = makeIcon("BookMarked");
export const BookOpen = makeIcon("BookOpen");
export const Bot = makeIcon("Bot");
export const Briefcase = makeIcon("Briefcase");
export const Building2 = makeIcon("Building2");
export const Calculator = makeIcon("Calculator");
export const Calendar = makeIcon("Calendar");
export const CalendarCheck = makeIcon("CalendarCheck");
export const Camera = makeIcon("Camera");
export const Check = makeIcon("Check");
export const CheckCheck = makeIcon("CheckCheck");
export const CheckCircle = makeIcon("CheckCircle");
export const CheckCircle2 = makeIcon("CheckCircle2");
export const CheckSquare = makeIcon("CheckSquare");
export const ChevronDown = makeIcon("ChevronDown");
export const ChevronLeft = makeIcon("ChevronLeft");
export const ChevronRight = makeIcon("ChevronRight");
export const CircleUser = makeIcon("CircleUser");
export const ClipboardList = makeIcon("ClipboardList");
export const Clock = makeIcon("Clock");
export const Compass = makeIcon("Compass");
export const Copy = makeIcon("Copy");
export const CreditCard = makeIcon("CreditCard");
export const Crop = makeIcon("Crop");
export const Database = makeIcon("Database");
export const DollarSign = makeIcon("DollarSign");
export const Download = makeIcon("Download");
export const Droplets = makeIcon("Droplets");
export const Edit = makeIcon("Edit");
export const Edit2 = makeIcon("Edit2");
export const ExternalLink = makeIcon("ExternalLink");
export const Eye = makeIcon("Eye");
export const EyeOff = makeIcon("EyeOff");
export const FileBarChart = makeIcon("FileBarChart");
export const FileCheck = makeIcon("FileCheck");
export const FilePlus = makeIcon("FilePlus");
export const FileSpreadsheet = makeIcon("FileSpreadsheet");
export const FileText = makeIcon("FileText");
export const FileUp = makeIcon("FileUp");
export const Filter = makeIcon("Filter");
export const Fingerprint = makeIcon("Fingerprint");
export const FolderOpen = makeIcon("FolderOpen");
export const Gavel = makeIcon("Gavel");
export const Globe = makeIcon("Globe");
export const GraduationCap = makeIcon("GraduationCap");
export const Hash = makeIcon("Hash");
export const Heart = makeIcon("Heart");
export const History = makeIcon("History");
export const Home = makeIcon("Home");
export const IdCardIcon = makeIcon("IdCardIcon");
export const ImageIcon = makeIcon("ImageIcon");
export const Inbox = makeIcon("Inbox");
export const Info = makeIcon("Info");
export const KeyRound = makeIcon("KeyRound");
export const Layers = makeIcon("Layers");
export const Layout = makeIcon("Layout");
export const LayoutDashboard = makeIcon("LayoutDashboard");
export const LayoutGrid = makeIcon("LayoutGrid");
export const Library = makeIcon("Library");
export const List = makeIcon("List");
export const Loader2 = makeIcon("Loader2");
export const Lock = makeIcon("Lock");
export const LogIn = makeIcon("LogIn");
export const LogOut = makeIcon("LogOut");
export const Mail = makeIcon("Mail");
export const MapPin = makeIcon("MapPin");
export const Menu = makeIcon("Menu");
export const MessageCircle = makeIcon("MessageCircle");
export const MessageSquare = makeIcon("MessageSquare");
export const Minus = makeIcon("Minus");
export const MonitorPlay = makeIcon("MonitorPlay");
export const Moon = makeIcon("Moon");
export const MoreVertical = makeIcon("MoreVertical");
export const Package = makeIcon("Package");
export const Paperclip = makeIcon("Paperclip");
export const PenLine = makeIcon("PenLine");
export const Phone = makeIcon("Phone");
export const PieChart = makeIcon("PieChart");
export const Plus = makeIcon("Plus");
export const Printer = makeIcon("Printer");
export const QrCode = makeIcon("QrCode");
export const RefreshCcw = makeIcon("RefreshCcw");
export const RefreshCw = makeIcon("RefreshCw");
export const Reply = makeIcon("Reply");
export const RotateCcw = makeIcon("RotateCcw");
export const Save = makeIcon("Save");
export const Scroll = makeIcon("Scroll");
export const Search = makeIcon("Search");
export const Send = makeIcon("Send");
export const Server = makeIcon("Server");
export const Settings = makeIcon("Settings");
export const Settings2 = makeIcon("Settings2");
export const Wrench = makeIcon("Wrench");
export const AtSign = makeIcon("AtSign");
export const Wifi = makeIcon("Wifi");
export const WifiOff = makeIcon("WifiOff");
export const Palette = makeIcon("Palette");
export const Users2 = makeIcon("Users2");
export const ShieldOff = makeIcon("ShieldOff");
export const Monitor = makeIcon("Monitor");
export const Shield = makeIcon("Shield");
export const ShieldAlert = makeIcon("ShieldAlert");
export const ShieldCheck = makeIcon("ShieldCheck");
export const ShieldX = makeIcon("ShieldX");
export const SlidersHorizontal = makeIcon("SlidersHorizontal");
export const Smartphone = makeIcon("Smartphone");
export const Sparkles = makeIcon("Sparkles");
export const Square = makeIcon("Square");
export const Star = makeIcon("Star");
export const Stethoscope = makeIcon("Stethoscope");
export const Sun = makeIcon("Sun");
export const Thermometer = makeIcon("Thermometer");
export const Timer = makeIcon("Timer");
export const Trash2 = makeIcon("Trash2");
export const TrendingDown = makeIcon("TrendingDown");
export const TrendingUp = makeIcon("TrendingUp");
export const Trophy = makeIcon("Trophy");
export const Upload = makeIcon("Upload");
export const UploadCloud = makeIcon("UploadCloud");
export const User = makeIcon("User");
export const UserCheck = makeIcon("UserCheck");
export const UserPlus = makeIcon("UserPlus");
export const Users = makeIcon("Users");
export const Wallet = makeIcon("Wallet");
export const Wind = makeIcon("Wind");
export const X = makeIcon("X");
export const XCircle = makeIcon("XCircle");
export const Zap = makeIcon("Zap");
export const ZoomIn = makeIcon("ZoomIn");
export const ZoomOut = makeIcon("ZoomOut");

