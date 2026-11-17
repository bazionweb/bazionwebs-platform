import React, { useState, useEffect, useRef } from 'react';
import {
  UsersIcon,
  UserCheckIcon,
  UserPlusIcon,
  SearchIcon,
  FilterIcon,
  CollectionIcon,
  MailIcon,
  PhoneIcon,
  ChevronDownIcon,
  CheckCircleIcon as SolidCheckIcon,
} from './Icons';
import { Member } from './memberData';
import { TransformedAvatar } from './AvatarEditor';
import { useTheme } from './ThemeContext';
import ActionButtons from './ActionButtons';
import PageHeader from './PageHeader';

const departments = [
  'Head Pastor',
  'Choir',
  'Media',
  'Ushering',
  'Protocol',
  'Welfare',
  'Intercessors',
  'Junior Youth',
  'Youth',
  'Traffic',
  'Administration',
  'Instrumentalist',
  'Deacon',
  "Pastor's Wife",
  'Sunday School',
  'Pastoral Care',
  'Evangelism',
  'Technical',
  'None',
];
const statuses: Member['status'][] = ['Active', 'Inactive', 'Transferred'];

const MemberStatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string }> = ({
  title,
  value,
  icon: Icon,
  color,
}) => (
  <div className={`p-4 rounded-lg shadow-md flex items-center ${color} text-white`}>
    <div className="p-3 bg-white/20 rounded-lg mr-4">
      <Icon className="h-6 w-6" />
    </div>
    <div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm">{title}</p>
    </div>
  </div>
);

const CustomDropdown: React.FC<{
  items: string[];
  selected: string;
  setSelected: (item: string) => void;
  defaultLabel: string;
  icon?: React.ElementType;
}> = ({ items, selected, setSelected, defaultLabel, icon: Icon }) => {
  const { modeColors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownRef]);

  const handleSelect = (item: string) => {
    setSelected(item);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full ${modeColors.card} border ${modeColors.border} ${modeColors.text} py-2 px-4 rounded-lg flex items-center justify-between text-left`}
      >
        <span className="flex items-center">
          {Icon && <Icon className={`h-5 w-5 mr-2 ${modeColors.textSecondary}`} />}
          {selected}
        </span>
        <ChevronDownIcon className="h-5 w-5" />
      </button>
      {isOpen && (
        <div
          className={`absolute z-50 w-full mt-1 ${modeColors.card} rounded-md shadow-lg border ${modeColors.border}`}
        >
          <ul className="max-h-60 overflow-auto py-1">
            <li
              onClick={() => handleSelect(defaultLabel)}
              className={`px-4 py-2 text-sm cursor-pointer flex items-center justify-between ${selected === defaultLabel ? 'bg-blue-500 text-white hover:bg-blue-600' : `${modeColors.text} ${modeColors.hover}`}`}
            >
              {defaultLabel}
              {selected === defaultLabel && <SolidCheckIcon className="h-4 w-4" />}
            </li>
            {items.map((item) => (
              <li
                key={item}
                onClick={() => handleSelect(item)}
                className={`px-4 py-2 text-sm cursor-pointer flex items-center justify-between ${selected === item ? 'font-semibold' : ''} ${modeColors.text} ${modeColors.hover}`}
              >
                {item}
                {selected === item && <SolidCheckIcon className="h-4 w-4 text-green-500" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

interface MembersPageProps {
  setActivePage: (page: string) => void;
  members: Member[];
  onDeleteMember: (id: string) => void;
  onEditMember: (member: Member) => void;
  onViewMember: (member: Member) => void;
}

const MembersPage: React.FC<MembersPageProps> = ({
  setActivePage,
  members,
  onDeleteMember,
  onEditMember,
  onViewMember,
}) => {
  const { colors, modeColors } = useTheme();
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMembers = members.filter((member) => {
    const matchesDepartment = selectedDepartment === 'All Departments' || member.department === selectedDepartment;
    const matchesStatus = selectedStatus === 'All Status' || member.status === selectedStatus;
    const matchesSearch =
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.phone && member.phone.includes(searchTerm)) ||
      (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesDepartment && matchesStatus && matchesSearch;
  });

  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.status === 'Active').length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const newMembersCount = members.filter((m) => {
    if (!m.dateAdded) return false;
    return new Date(m.dateAdded) >= thirtyDaysAgo;
  }).length;

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'Active':
        return (
          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>
        );
      case 'Inactive':
        return <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
      case 'Transferred':
        return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Members Directory"
        subtitle="Manage and view all church members in one place. Search, filter, and perform actions on member records."
        icon={<UsersIcon className="h-8 w-8 text-emerald-600" />}
        actions={
          <div className="flex gap-3">
            <button
              onClick={() => setActivePage('Add Member')}
              className={`${colors.primary} ${colors.primaryHover} text-white font-semibold py-2 px-4 rounded-lg flex items-center`}
            >
              <UserPlusIcon className="h-5 w-5 mr-2" /> Add New Member
            </button>
            <button
              onClick={() => setActivePage('Manage Groups')}
              className={`${colors.primary} ${colors.primaryHover} text-white font-semibold py-2 px-4 rounded-lg flex items-center`}
            >
              <CollectionIcon className="h-5 w-5 mr-2" /> Groups Management
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
          <MemberStatCard
            title="Total Members"
            value={totalMembers.toString()}
            icon={UsersIcon}
            color="bg-emerald-600"
          />
          <MemberStatCard title="Active" value={activeMembers.toString()} icon={UserCheckIcon} color="bg-green-500" />
          <MemberStatCard
            title="New (30d)"
            value={newMembersCount.toString()}
            icon={UserPlusIcon}
            color="bg-blue-500"
          />
        </div>

        <div className={`${modeColors.card} p-4 rounded-lg shadow-sm`}>
          <h3 className={`text-md font-semibold ${modeColors.text} mb-3 flex items-center`}>
            <FilterIcon className={`h-5 w-5 mr-2 ${modeColors.textSecondary}`} /> Search & Filters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-1">
              <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${modeColors.textSecondary}`}>
                <SearchIcon className="h-5 w-5" />
              </span>
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 ${modeColors.card} ${modeColors.text} border ${modeColors.border} rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500`}
              />
            </div>
            <CustomDropdown
              items={departments}
              selected={selectedDepartment}
              setSelected={setSelectedDepartment}
              defaultLabel="All Departments"
            />
            <CustomDropdown
              items={statuses}
              selected={selectedStatus}
              setSelected={setSelectedStatus}
              defaultLabel="All Status"
            />
          </div>
        </div>

        <div className={`${modeColors.card} rounded-lg shadow-sm overflow-hidden`}>
          <div className={`p-4 border-b flex items-center flex-wrap ${modeColors.border}`}>
            <h3 className={`text-md font-semibold ${modeColors.text} flex items-center mr-4`}>
              <UsersIcon className={`h-5 w-5 mr-2 ${modeColors.textSecondary}`} /> Members List
            </h3>
            <span className="bg-emerald-600 text-white text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">
              {filteredMembers.length} members
            </span>
            <span className={`text-sm ${modeColors.textSecondary}`}>
              Results update in real-time as you search and filter
            </span>
          </div>
          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full text-sm text-left text-gray-500 relative">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th scope="col" className={`px-6 py-3 ${modeColors.bgSecondary}`}>
                    Member ID
                  </th>
                  <th scope="col" className={`px-6 py-3 ${modeColors.bgSecondary}`}>
                    Name
                  </th>
                  <th scope="col" className={`px-6 py-3 ${modeColors.bgSecondary}`}>
                    Contact
                  </th>
                  <th scope="col" className={`px-6 py-3 ${modeColors.bgSecondary}`}>
                    Department
                  </th>
                  <th scope="col" className={`px-6 py-3 ${modeColors.bgSecondary}`}>
                    Age Group
                  </th>
                  <th scope="col" className={`px-6 py-3 ${modeColors.bgSecondary}`}>
                    Role
                  </th>
                  <th scope="col" className={`px-6 py-3 ${modeColors.bgSecondary}`}>
                    Status
                  </th>
                  <th scope="col" className={`px-6 py-3 ${modeColors.bgSecondary}`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className={`${modeColors.card} border-b ${modeColors.border} ${modeColors.hover}`}
                  >
                    <td className={`px-6 py-4 font-semibold ${modeColors.text}`}>{member.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <TransformedAvatar
                          src={member.avatar}
                          transform={member.avatarTransform}
                          className="w-10 h-10 rounded-full"
                          alt={member.name}
                        />
                        <div className="pl-3">
                          <div className={`text-base font-semibold ${modeColors.text} capitalize`}>{member.name}</div>
                          <div className={`font-normal ${modeColors.textSecondary} capitalize`}>{member.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {member.phone && (
                        <div className={`flex items-center ${modeColors.text}`}>
                          <PhoneIcon className="w-4 h-4 mr-2" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      {member.email && (
                        <div className={`flex items-center ${modeColors.text} ${member.phone ? 'mt-1' : ''}`}>
                          <MailIcon className="w-4 h-4 mr-2" />
                          <span>{member.email}</span>
                        </div>
                      )}
                      {!member.phone && !member.email && (
                        <span className={`text-gray-400 text-sm ${modeColors.text}`}>No contact info</span>
                      )}
                    </td>
                    <td className={`px-6 py-4 ${modeColors.text}`}>{member.department}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          member.ageGroup === 'Children/Sunday School'
                            ? 'bg-blue-100 text-blue-800'
                            : member.ageGroup === 'Junior Youth'
                              ? 'bg-green-100 text-green-800'
                              : member.ageGroup === 'Youth'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {member.ageGroup || 'Adult'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center ${modeColors.text}`}>
                        <div
                          className={`h-2.5 w-2.5 rounded-full mr-2 ${member.role === 'Leader' ? 'bg-yellow-500' : 'bg-green-500'}`}
                        ></div>{' '}
                        {member.role}
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusChip(member.status)}</td>
                    <td className="px-6 py-4">
                      <ActionButtons
                        onView={() => onViewMember(member)}
                        onEdit={() => onEditMember(member)}
                        onDelete={() => onDeleteMember(member.id)}
                        itemName={member.name}
                        itemType="Member"
                        itemDetails={{
                          Email: member.email || 'Not provided',
                          Phone: member.phone || 'Not provided',
                          Department: member.department,
                          'Age Group': member.ageGroup || 'Adult',
                          Status: member.status,
                        }}
                        size="md"
                        variant="icon"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembersPage;
