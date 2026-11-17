import React, { useState, useMemo } from 'react';
import { Member } from './memberData';
import { Transaction } from './financeData';
import { AttendanceRecord } from './attendanceData';
import {
  ArrowLeftIcon,
  UserIcon,
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  LocationMarkerIcon,
  CollectionIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  TrendingUpIcon,
} from './Icons';
import { Copy, Check, AtSign } from 'lucide-react';
import { TransformedAvatar } from './AvatarEditor';
import ActionButtons from './ActionButtons';

interface MemberDetailsPageProps {
  member: Member;
  onBack: () => void;
  onEdit: (member: Member) => void;
  onDelete: (id: string) => void;
  transactions?: Transaction[];
  attendanceRecords?: AttendanceRecord[];
}

const DetailItem: React.FC<{ label: string; value: string | undefined; icon: React.ElementType }> = ({
  label,
  value,
  icon: Icon,
}) => (
  <div>
    <dt className="text-sm font-medium text-gray-500 flex items-center">
      <Icon className="h-4 w-4 mr-2" /> {label}
    </dt>
    <dd className="mt-1 text-sm text-gray-900 capitalize">{value || 'N/A'}</dd>
  </div>
);

const MemberDetailsPage: React.FC<MemberDetailsPageProps> = ({
  member,
  onBack,
  onEdit,
  onDelete,
  transactions = [],
  attendanceRecords = [],
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'attendance' | 'finance'>('profile');
  const [copied, setCopied] = useState(false);

  const handleCopyOrgEmail = () => {
    if (member.org_email) {
      navigator.clipboard.writeText(member.org_email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeleteClick = () => {
    onDelete(member.id);
  };

  // --- Financial Stats ---
  const memberTransactions = useMemo(() => {
    if (!member.email) return [];
    return transactions
      .filter((t) => t.memberId === member.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, member.email]);

  const financialStats = useMemo(() => {
    const total = memberTransactions.reduce((sum, t) => sum + t.amount, 0);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthTotal = memberTransactions
      .filter((t) => new Date(t.date) >= lastMonth)
      .reduce((sum, t) => sum + t.amount, 0);
    return { total, lastMonthTotal, count: memberTransactions.length };
  }, [memberTransactions]);

  // --- Attendance Stats ---
  const memberAttendance = useMemo(() => {
    return attendanceRecords
      .filter((r) => r.memberName.toLowerCase() === member.name.toLowerCase())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendanceRecords, member.name]);

  const attendanceStats = useMemo(() => {
    const total = memberAttendance.length;
    const present = memberAttendance.filter((r) => r.status === 'Present').length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, rate };
  }, [memberAttendance]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 capitalize">{member.name}</h1>
          <p className="mt-1 text-gray-600">Member ID: {member.id}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center hover:bg-gray-300"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back
          </button>
          <ActionButtons
            onEdit={() => onEdit(member)}
            onDelete={handleDeleteClick}
            itemName={member.name}
            itemType="Member"
            itemDetails={{
              Email: member.email || 'Not provided',
              Phone: member.phone || 'Not provided',
              Department: member.department,
              Title: member.title,
              Status: member.status,
              'Date Added': new Date(member.dateAdded).toLocaleDateString(),
            }}
            size="md"
            variant="both"
            editLabel="Edit Member"
            deleteLabel="Delete Member"
          />
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white rounded-lg shadow-sm border p-6 flex flex-col md:flex-row items-center gap-6">
        <TransformedAvatar
          src={member.avatar}
          transform={member.avatarTransform}
          className="w-24 h-24 rounded-full border-4 border-gray-100"
          alt={member.name}
        />
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-2xl font-bold text-gray-800 capitalize">{member.name}</h2>
          <p className="text-md text-gray-600 capitalize">
            {member.title} - {member.department}
          </p>
          <div className="mt-2 flex flex-wrap justify-center md:justify-start gap-4 text-sm text-gray-500">
            {member.email && (
              <span className="flex items-center">
                <MailIcon className="h-4 w-4 mr-1.5" />
                {member.email}
              </span>
            )}
            {member.phone && (
              <span className="flex items-center">
                <PhoneIcon className="h-4 w-4 mr-1.5" />
                {member.phone}
              </span>
            )}
            {member.org_email && (
              <span className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                <AtSign className="h-4 w-4" />
                {member.org_email}
                <button
                  onClick={handleCopyOrgEmail}
                  className="p-0.5 hover:bg-indigo-100 rounded transition-colors"
                  title="Copy email address"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </span>
            )}
            {!member.email && !member.phone && !member.org_email && (
              <span className="text-gray-400">No contact information</span>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-green-600 uppercase font-bold">Attendance</p>
            <p className="text-xl font-bold text-green-700">{attendanceStats.rate}%</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600 uppercase font-bold">Total Given</p>
            <p className="text-xl font-bold text-blue-700">KSH {(financialStats.total / 1000).toFixed(1)}k</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'profile' ? 'bg-gray-50 text-church-green border-b-2 border-church-green' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Profile Details
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'attendance' ? 'bg-gray-50 text-church-green border-b-2 border-church-green' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Attendance History
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'finance' ? 'bg-gray-50 text-church-green border-b-2 border-church-green' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Giving History
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 animate-fade-in-up">
              <DetailItem label="Date of Birth" value={new Date(member.dob).toLocaleDateString()} icon={CalendarIcon} />
              <DetailItem label="Gender" value={member.gender} icon={UserIcon} />
              <DetailItem label="Marital Status" value={member.maritalStatus} icon={UserIcon} />
              <DetailItem label="Occupation" value={member.occupation} icon={UserIcon} />
              <DetailItem label="Location / Address" value={member.location} icon={LocationMarkerIcon} />
              <DetailItem label="Role" value={member.role} icon={CollectionIcon} />
              <DetailItem label="Member Status" value={member.status} icon={CollectionIcon} />
              {member.org_email && <DetailItem label="Church Email" value={member.org_email} icon={AtSign} />}
              <DetailItem
                label="Date Added"
                value={new Date(member.dateAdded).toLocaleDateString()}
                icon={CalendarIcon}
              />
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="animate-fade-in-up space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-gray-500 text-sm">Services Attended</p>
                  <p className="text-2xl font-bold">{attendanceStats.present}</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-gray-500 text-sm">Total Services Recorded</p>
                  <p className="text-2xl font-bold">{attendanceStats.total}</p>
                </div>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-gray-500 text-sm">Attendance Rate</p>
                  <p
                    className={`text-2xl font-bold ${attendanceStats.rate >= 75 ? 'text-green-600' : 'text-yellow-600'}`}
                  >
                    {attendanceStats.rate}%
                  </p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Service</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberAttendance.map((record) => (
                      <tr key={record.id} className="border-t">
                        <td className="px-4 py-2">{new Date(record.date).toLocaleDateString()}</td>
                        <td className="px-4 py-2">{record.service}</td>
                        <td className="px-4 py-2">
                          {record.status === 'Present' && (
                            <span className="flex items-center text-green-600">
                              <CheckCircleIcon className="w-4 h-4 mr-1" /> Present
                            </span>
                          )}
                          {record.status === 'Absent' && (
                            <span className="flex items-center text-red-600">
                              <XCircleIcon className="w-4 h-4 mr-1" /> Absent
                            </span>
                          )}
                          {record.status === 'Late' && (
                            <span className="flex items-center text-yellow-600">
                              <ClockIcon className="w-4 h-4 mr-1" /> Late
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {memberAttendance.length === 0 && (
                  <p className="text-center p-4 text-gray-500">No attendance records found.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="animate-fade-in-up space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border rounded-lg p-4 flex items-center">
                  <div className="p-3 bg-green-100 rounded-full mr-4 text-green-600">
                    <CurrencyDollarIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Total Contribution</p>
                    <p className="text-2xl font-bold">KSH {financialStats.total.toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-4 flex items-center">
                  <div className="p-3 bg-blue-100 rounded-full mr-4 text-blue-600">
                    <TrendingUpIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Last 30 Days</p>
                    <p className="text-2xl font-bold">KSH {financialStats.lastMonthTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2">Amount</th>
                      <th className="px-4 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberTransactions.map((t) => (
                      <tr key={t.id} className="border-t">
                        <td className="px-4 py-2">{new Date(t.date).toLocaleDateString()}</td>
                        <td className="px-4 py-2">
                          <span className="bg-gray-100 px-2 py-1 rounded-full text-xs">{t.category}</span>
                        </td>
                        <td className="px-4 py-2 font-semibold text-gray-800">KSH {t.amount.toLocaleString()}</td>
                        <td className="px-4 py-2 text-gray-500">{t.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {memberTransactions.length === 0 && (
                  <p className="text-center p-4 text-gray-500">No transactions recorded.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default MemberDetailsPage;
