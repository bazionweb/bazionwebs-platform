import React, { useState, useMemo } from 'react';
import { Visitor, VisitorStatus } from './visitorData';
import { UsersIcon, UserPlusIcon, ArrowRightIcon, CalendarIcon } from './Icons';
import ActionButtons from './ActionButtons';

interface VisitorManagementPageProps {
  visitors: Visitor[];
  onViewDetails: (id: number) => void;
  onRegisterVisitor: () => void;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string }> = ({
  title,
  value,
  icon: Icon,
  color,
}) => (
  <div className={`p-4 rounded-lg shadow-md flex items-center text-white ${color}`}>
    <div className="p-3 bg-white/20 rounded-lg mr-4">
      <Icon className="h-6 w-6" />
    </div>
    <div>
      <p className="text-sm uppercase font-semibold">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

const getStatusChip = (status: VisitorStatus) => {
  switch (status) {
    case 'In follow up':
      return (
        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>
      );
    case 'Converted':
      return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
    case 'New':
      return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
  }
};

const VisitorManagementPage: React.FC<VisitorManagementPageProps> = ({
  visitors,
  onViewDetails,
  onRegisterVisitor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<VisitorStatus | 'All'>('All');

  const stats = useMemo(() => {
    const total = visitors.length;
    const newVisitors = visitors.filter((v) => v.status === 'New').length;
    const inFollowUp = visitors.filter((v) => v.status === 'In follow up').length;
    const converted = visitors.filter((v) => v.status === 'Converted').length;
    return { total, newVisitors, inFollowUp, converted };
  }, [visitors]);

  const filteredVisitors = useMemo(() => {
    return visitors
      .filter((v) => {
        const matchesFilter = activeFilter === 'All' || v.status === activeFilter;
        const matchesSearch =
          searchTerm === '' || v.name.toLowerCase().includes(searchTerm.toLowerCase()) || v.phone.includes(searchTerm);
        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => new Date(b.firstVisit).getTime() - new Date(a.firstVisit).getTime());
  }, [visitors, activeFilter, searchTerm]);

  const timeSince = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';
    interval = seconds / 604800;
    if (interval > 1) return Math.floor(interval) + ' weeks ago';
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';
    return 'today';
  };

  const upcomingFollowUps = visitors
    .filter(
      (v) =>
        v.status === 'In follow up' &&
        v.followUps?.some((f) => f.nextFollowUpDate && new Date(f.nextFollowUpDate) >= new Date()),
    )
    .flatMap((v) => v.followUps!.map((f) => ({ ...f, visitorName: v.name, visitorId: v.id })))
    .filter((f) => f.nextFollowUpDate && new Date(f.nextFollowUpDate) >= new Date())
    .sort((a, b) => new Date(a.nextFollowUpDate!).getTime() - new Date(b.nextFollowUpDate!).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Visitor Management</h1>
          <p className="mt-1 text-gray-600">Track and manage church visitors.</p>
        </div>
        <button
          onClick={onRegisterVisitor}
          className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center"
        >
          <UserPlusIcon className="h-5 w-5 mr-2" /> Register New Visitor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Visitors" value={stats.total.toString()} icon={UsersIcon} color="bg-blue-500" />
        <StatCard title="New Visitors" value={stats.newVisitors.toString()} icon={UserPlusIcon} color="bg-green-500" />
        <StatCard
          title="In Follow-up"
          value={stats.inFollowUp.toString()}
          icon={ArrowRightIcon}
          color="bg-yellow-500"
        />
        <StatCard
          title="Converted to Members"
          value={stats.converted.toString()}
          icon={UsersIcon}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-700">Visitors</h3>
            <div className="flex justify-between items-center mt-2">
              <input
                type="text"
                placeholder="Search visitors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-1/2 border-gray-300 rounded-lg shadow-sm px-4 py-2 text-sm"
              />
              <div className="flex bg-gray-100 p-1 rounded-lg text-sm">
                <button
                  onClick={() => setActiveFilter('All')}
                  className={`px-3 py-1 rounded-md font-semibold ${activeFilter === 'All' ? 'bg-white shadow' : 'text-gray-600'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveFilter('New')}
                  className={`px-3 py-1 rounded-md font-semibold ${activeFilter === 'New' ? 'bg-white shadow' : 'text-gray-600'}`}
                >
                  New
                </button>
                <button
                  onClick={() => setActiveFilter('In follow up')}
                  className={`px-3 py-1 rounded-md font-semibold ${activeFilter === 'In follow up' ? 'bg-white shadow' : 'text-gray-600'}`}
                >
                  In Follow-up
                </button>
                <button
                  onClick={() => setActiveFilter('Converted')}
                  className={`px-3 py-1 rounded-md font-semibold ${activeFilter === 'Converted' ? 'bg-white shadow' : 'text-gray-600'}`}
                >
                  Converted
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm text-left text-gray-600 relative">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 bg-gray-50">Name</th>
                  <th className="px-6 py-3 bg-gray-50">Contact</th>
                  <th className="px-6 py-3 bg-gray-50">First Visit</th>
                  <th className="px-6 py-3 bg-gray-50">Status</th>
                  <th className="px-6 py-3 bg-gray-50">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisitors.map((v) => (
                  <tr key={v.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-xs mr-3">
                          {v.initials}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 capitalize">{v.name}</p>
                          <p className="text-xs text-gray-500">Heard from: {v.heardFrom}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p>{v.phone}</p>
                      {v.email && <p className="text-xs text-gray-500">{v.email}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <p>
                        {new Date(v.firstVisit).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-xs text-gray-500">{timeSince(v.firstVisit)}</p>
                    </td>
                    <td className="px-6 py-4">{getStatusChip(v.status)}</td>
                    <td className="px-6 py-4">
                      <ActionButtons
                        onView={() => onViewDetails(v.id)}
                        itemName={v.name}
                        itemType="Visitor"
                        itemDetails={{
                          Phone: v.phone,
                          Email: v.email || 'N/A',
                          'First Visit': new Date(v.firstVisit).toLocaleDateString(),
                          Status: v.status,
                          'Heard From': v.heardFrom,
                        }}
                        size="md"
                        variant="icon"
                        showConfirmation={false} // Just viewing details, no confirmation needed
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredVisitors.length === 0 && <p className="text-center p-8 text-gray-500">No visitors found.</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Upcoming Follow-ups</h3>
          {upcomingFollowUps.length > 0 ? (
            <ul className="space-y-3">
              {upcomingFollowUps.map((f) => (
                <li key={f.id} className="flex items-start text-sm">
                  <CalendarIcon className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-800 capitalize">{f.visitorName}</p>
                    <p className="text-xs text-gray-500">
                      Due:{' '}
                      {new Date(f.nextFollowUpDate!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} -{' '}
                      {f.interactionType}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CalendarIcon className="h-10 w-10 mx-auto text-gray-300 mb-2" />
              <p>No upcoming follow-ups</p>
            </div>
          )}
        </div>
      </div>
      <footer className="text-center text-sm text-gray-500 mt-8 pt-4 border-t">
        © {new Date().getFullYear()} All rights reserved. Church Management System
      </footer>
    </div>
  );
};
export default VisitorManagementPage;
