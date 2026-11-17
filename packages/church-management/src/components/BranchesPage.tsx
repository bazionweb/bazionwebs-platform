import React, { useState } from 'react';
import { Branch } from './branchData';
import { TransformedAvatar } from './AvatarEditor';
import {
  PlusIcon,
  SearchIcon,
  MailIcon,
  PhoneIcon,
  LocationMarkerIcon,
  UsersIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from './Icons';
import { Building2, Users, TrendingUp } from 'lucide-react';
import ActionButtons from './ActionButtons';

interface BranchesPageProps {
  branches: Branch[];
  onAddBranch: () => void;
  onEditBranch: (branch: Branch) => void;
  onDeleteBranch: (id: string) => void;
  onViewBranch: (branch: Branch) => void;
  canEdit: boolean;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType; color: string }> = ({
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

const BranchCard: React.FC<{
  branch: Branch;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
  canEdit: boolean;
}> = ({ branch, onEdit, onDelete, onView, canEdit }) => {
  const [expanded, setExpanded] = useState(false);

  const totalGiving = branch.givingRecords.reduce((sum, r) => sum + r.amount, 0);
  const thisMonthGiving = branch.givingRecords
    .filter((r) => {
      const date = new Date(r.date);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <TransformedAvatar
              src={branch.pastor.avatar}
              transform={branch.pastor.avatarTransform}
              className="w-16 h-16 rounded-full border-2 border-gray-200"
              alt={branch.pastor.name}
            />
            <div>
              <h3 className="text-lg font-bold text-gray-800">{branch.name}</h3>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <LocationMarkerIcon className="w-4 h-4" />
                {branch.location}
              </p>
              <p className="text-sm text-green-600 font-medium mt-1">Pastor: {branch.pastor.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <ActionButtons
              onView={onView}
              onEdit={canEdit ? onEdit : undefined}
              onDelete={canEdit ? onDelete : undefined}
              itemName={branch.name}
              itemType="Branch"
              itemDetails={{
                Location: branch.location,
                Pastor: branch.pastor.name,
                'Total Members': branch.memberCount.total,
                'Male Members': branch.memberCount.male,
                'Female Members': branch.memberCount.female,
              }}
              size="md"
              variant="icon"
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">{branch.memberCount.total}</p>
            <p className="text-xs text-gray-600">Members</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">KSH {thisMonthGiving.toLocaleString()}</p>
            <p className="text-xs text-gray-600">This Month</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-600">KSH {totalGiving.toLocaleString()}</p>
            <p className="text-xs text-gray-600">Total Giving</p>
          </div>
        </div>

        {/* Expand/Collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          {expanded ? 'Show Less' : 'Show More'}
          {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Pastor Details</h4>
              <p className="flex items-center gap-2 text-gray-600">
                <MailIcon className="w-4 h-4" /> {branch.pastor.email}
              </p>
              <p className="flex items-center gap-2 text-gray-600 mt-1">
                <PhoneIcon className="w-4 h-4" /> {branch.pastor.phone}
              </p>
              <p className="text-gray-600 mt-1">
                {branch.pastor.gender} • {branch.pastor.maritalStatus}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Member Breakdown</h4>
              <p className="text-gray-600">Male: {branch.memberCount.male}</p>
              <p className="text-gray-600">Female: {branch.memberCount.female}</p>
            </div>
          </div>

          {/* Recent Giving */}
          {branch.givingRecords.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-gray-700 mb-2">Recent Giving Records</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {branch.givingRecords.slice(0, 5).map((record) => (
                  <div key={record.id} className="flex justify-between items-center bg-white p-2 rounded border">
                    <div>
                      <span className="font-medium">{record.type}</span>
                      <span className="text-gray-500 text-xs ml-2">{record.date}</span>
                    </div>
                    <span className="font-semibold text-green-600">KSH {record.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const BranchesPage: React.FC<BranchesPageProps> = ({
  branches,
  onAddBranch,
  onEditBranch,
  onDeleteBranch,
  onViewBranch,
  canEdit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBranches = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.pastor.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalMembers = branches.reduce((sum, b) => sum + b.memberCount.total, 0);
  const totalMale = branches.reduce((sum, b) => sum + b.memberCount.male, 0);
  const totalFemale = branches.reduce((sum, b) => sum + b.memberCount.female, 0);
  const totalGiving = branches.reduce((sum, b) => sum + b.givingRecords.reduce((s, r) => s + r.amount, 0), 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Branch Management</h1>
          <p className="text-gray-500">Manage all church branches from headquarters</p>
        </div>
        {canEdit && (
          <button
            onClick={onAddBranch}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Add Branch
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Branches" value={branches.length} icon={Building2} color="bg-blue-500" />
        <StatCard title="Total Members" value={totalMembers} icon={Users} color="bg-green-500" />
        <StatCard
          title="Male / Female"
          value={`${totalMale} / ${totalFemale}`}
          icon={UsersIcon}
          color="bg-purple-500"
        />
        <StatCard
          title="Total Giving"
          value={`KSH ${totalGiving.toLocaleString()}`}
          icon={TrendingUp}
          color="bg-orange-500"
        />
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search branches by name, location, or pastor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div>

      {/* Branch Cards */}
      {filteredBranches.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">No Branches Found</h3>
          <p className="text-gray-500 mt-2">
            {branches.length === 0 ? 'Add your first branch to get started' : 'No branches match your search criteria'}
          </p>
          {canEdit && branches.length === 0 && (
            <button
              onClick={onAddBranch}
              className="mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg"
            >
              Add First Branch
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredBranches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              onEdit={() => onEditBranch(branch)}
              onDelete={() => onDeleteBranch(branch.id)}
              onView={() => onViewBranch(branch)}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchesPage;
