import React from 'react';
import {
  DashboardIcon,
  MembersIcon,
  AttendanceIcon,
  FinanceIcon,
  EquipmentIcon,
  SmsIcon,
  VisitorsIcon,
  ReportsIcon,
  UsersIcon,
  SettingsIcon,
  AiIcon,
  GiftIcon,
  TrashIcon,
} from './Icons';
import { Building2, Users2, Shield, Activity, MessageSquare } from 'lucide-react';
import { User, AccessibleSection } from './userData';
import { useTheme } from './ThemeContext';
import { canAccessSection } from './AccessControl';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
  currentUser?: User | null;
  onMobileClose?: () => void;
}

interface NavItem {
  name: string;
  icon: React.FC<{ className?: string }>;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  section?: AccessibleSection;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', icon: DashboardIcon },
  { name: 'Members', icon: MembersIcon, section: 'Members' },
  { name: 'Birthdays', icon: GiftIcon, section: 'Members' },
  { name: 'Attendance', icon: AttendanceIcon, section: 'Attendance' },
  { name: 'Finance', icon: FinanceIcon, section: 'Finance' },
  { name: 'Equipment', icon: EquipmentIcon, section: 'Equipment' },
  { name: 'SMS Broadcast', icon: SmsIcon, section: 'SMS Broadcast' },
  { name: 'Visitors', icon: VisitorsIcon, section: 'Visitors' },
  { name: 'Helpdesk', icon: MessageSquare, adminOnly: true },
  { name: 'Branches', icon: Building2, section: 'Branches' },
  { name: 'Reports', icon: ReportsIcon, adminOnly: true },
  { name: 'Users', icon: UsersIcon, superAdminOnly: true },
  { name: 'Data Personnel Management', icon: Users2, superAdminOnly: true },
  { name: 'User Session Monitor', icon: Activity, superAdminOnly: true },
  { name: 'Permission Requests', icon: Shield, superAdminOnly: true },
  { name: 'Recycle Bin', icon: TrashIcon, adminOnly: true },
  { name: 'Settings', icon: SettingsIcon },
  { name: 'AI Features', icon: AiIcon, adminOnly: true },
];

const canAccessItem = (item: NavItem, user: User | null | undefined): boolean => {
  if (!user) return false;

  // Super Admin can access everything
  if (user.role === 'Super Admin') return true;

  // Guest access - heavily restricted
  if (user.role === 'Guest') {
    // Guests can ONLY see Dashboard
    return item.name === 'Dashboard';
  }

  // If the user has explicitly assigned sections (enforced by Super Admin), respect those strictly
  if (user.assignedSections && Array.isArray(user.assignedSections)) {
    // Everyone except Guest gets Dashboard and Settings
    if (item.name === 'Dashboard' || item.name === 'Settings') return true;

    // For sectioned items, check if user has access to that section
    if (item.section) {
      return canAccessSection(user, item.section);
    }

    // For non-sectioned items (like Birthdays), allow if user has Members access
    if (item.name === 'Birthdays') {
      return canAccessSection(user, 'Members');
    }

    return false;
  }

  // Fallbacks for users who haven't had explicit sections assigned yet:
  if (user.role === 'Admin') return !item.superAdminOnly;

  if (user.role === 'Member') {
    if (item.superAdminOnly || item.adminOnly) return false;
    return true;
  }

  if (user.role === 'Data Personnel') {
    // Fallback: should be handled by assignedSections, but allow Dashboard/Settings if missing
    if (item.name === 'Dashboard' || item.name === 'Settings') return true;
    return false;
  }

  return false;
};

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, currentUser, onMobileClose }) => {
  const { colors } = useTheme();
  const filteredNavItems = navItems.filter((item) => canAccessItem(item, currentUser));

  const handleNavClick = (itemName: string) => {
    setActivePage(itemName);
    // Close mobile sidebar when item is clicked
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <div className={`w-64 ${colors.sidebar} text-white flex flex-col flex-shrink-0 h-screen`}>
      {/* Mobile Close Button */}
      <div className="lg:hidden flex justify-end p-4 mt-20">
        <button onClick={onMobileClose} className="text-white hover:text-gray-300 p-2" aria-label="Close menu">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4 mt-20 lg:mt-20">
        <div className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = activePage === item.name;
            return (
              <a
                key={item.name}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.name);
                }}
                className={`flex items-center px-4 py-3 lg:py-2.5 rounded-md transition-all duration-200 relative text-sm lg:text-base ${
                  isActive ? 'bg-gray-50 text-gray-900 shadow-inner' : 'text-white hover:bg-white/20'
                }`}
              >
                {isActive && (
                  <span className="absolute -left-2 top-[calc(50%-12px)] h-6 w-1 bg-yellow-400 rounded-full"></span>
                )}
                <item.icon className="h-5 w-5 mr-3 flex-shrink-0" />
                <span className="font-medium truncate">{item.name}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Sidebar;
