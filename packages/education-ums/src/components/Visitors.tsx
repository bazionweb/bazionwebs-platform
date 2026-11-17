import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, 
  
  
  
  LogIn, 
  LogOut, 
  Search, 
  Plus, 
  X, 
  CheckCircle2, 
  Trash2, 
  
  
  ShieldAlert, 
  
  
  UserCheck,
  Building2,
  Users
} from '../shims/lucide-react';
import { useApiDataStore } from '../stores/apiDataStore';
import { useDialogStore } from '../stores/dialogStore';

// interface Visitor {
//   id: string;
//   name: string;
//   purpose: string;
//   host: string;
//   checkIn: string;
//   checkOut?: string;
//   status: 'Active' | 'Checked Out';
// }

const Visitors: React.FC = () => {
  const {
    visitors,
    fetchVisitors,
    createVisitor,
    updateVisitor,
    deleteVisitor,
  } = useApiDataStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    purpose: '',
    host: '',
  });

  useEffect(() => {
    fetchVisitors();
  }, []);

  const filteredVisitors = useMemo(() => {
    return (visitors || [])
      .filter(v => {
        const matchesSearch = `${v.name} ${v.purpose} ${v.host} ${v.id}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All Status' || v.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a) => (a.status === 'Active' ? -1 : 1));
  }, [visitors, searchTerm, statusFilter]);

  const stats = {
    active: visitors.filter(v => v.status === 'Active').length,
    totalToday: visitors.length,
    checkedOut: visitors.filter(v => v.status === 'Checked Out').length
  };

  const handleCheckOut = async (id: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const success = await updateVisitor(id, { status: 'Checked Out', checkOut: time });
    if (!success) {
      await useDialogStore.getState().alert({
        title: "Check-Out Failed",
        message: "The visitor check-out could not be processed. Please retry or contact the Security Office.",
        variant: "warning",
        confirmText: "Close",
        badgeText: "Security Notice",
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const success = await createVisitor({
      ...formData,
      checkIn: time,
      status: 'Active'
    });

    if (success) {
      setIsModalOpen(false);
      setFormData({ name: '', purpose: '', host: '' });
    } else {
      await useDialogStore.getState().alert({
        title: "Visitor Registration Failed",
        message: "The visitor could not be registered in the campus security ledger. Please check the entry details and try again.",
        variant: "warning",
        confirmText: "Close",
        badgeText: "Security Notice",
      });
    }
  };

  const handleDeleteVisitor = async (id: string) => {
    const confirmed = await useDialogStore.getState().confirm({
      title: "Purge Visitor Record from Security Ledger",
      message: "Are you sure you want to permanently remove this visitor entry from the campus security registry?",
      detail: "This will erase all entry, check-in, and check-out records associated with this visitor. This action should only be performed with Security Office approval and is subject to institutional data retention compliance.",
      confirmText: "Purge Record",
      cancelText: "Retain Record",
      variant: "danger",
      badgeText: "Security Protocol",
    });
    if (confirmed) {
      const success = await deleteVisitor(id);
      if (!success) {
        await useDialogStore.getState().alert({
          title: "Purge Failed",
          message: "The visitor record could not be removed from the security ledger. Please contact the ICT Support team.",
          variant: "warning",
          confirmText: "Close",
          badgeText: "Security Notice",
        });
      }
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
           <div className="w-1.5 h-6 bg-[#FFD700] rounded-full flex-shrink-0"></div>
           <div className="flex flex-col">
              <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">Security & Visitor Control</h2>
              <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">BMI Institutional Access Ledger • Gate Security Node</p>
           </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
           <button 
             onClick={() => setIsModalOpen(true)}
             className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-[#4B0082] text-white rounded-lg shadow-md hover:bg-black transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider border border-[#FFD700]/30 cursor-pointer"
           >
            <Plus size={12} className="text-[#FFD700]" /> Register Guest
          </button>
        </div>
      </div>

      {/* Responsive Tab Bar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
         <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
            <Users size={13} />
            <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Entry Status</span>
         </div>
         {['All Status', 'Active', 'Checked Out'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                statusFilter === status 
                  ? 'bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50' 
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]'
              }`}
            >
              {status === 'Active' ? 'On-Site (Active)' : status === 'Checked Out' ? 'Checked Out (Exited)' : status}
            </button>
         ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-emerald-500 relative overflow-hidden group">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active On-Site</p>
                   <p className="text-4xl font-black text-emerald-600 mt-1">{stats.active}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"><UserCheck size={24} /></div>
             </div>
             <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:scale-110 transition-transform"><Building2 size={100} /></div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-8 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-[#4B0082] relative overflow-hidden group">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Daily Intake</p>
                   <p className="text-4xl font-black text-[#4B0082] dark:text-white mt-1">{stats.totalToday}</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-gray-700 rounded-none text-[#4B0082]"><LogIn size={24} /></div>
             </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-8 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-gray-500 relative overflow-hidden group">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Checked Out</p>
                   <p className="text-4xl font-black text-gray-600 dark:text-gray-300 mt-1">{stats.checkedOut}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 text-gray-500 rounded-none"><LogOut size={24} /></div>
             </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 flex flex-col md:flex-row gap-4 items-center shadow-sm">
           <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search Visitor Registry by Name, ID, Purpose or Host..." 
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none outline-none font-bold text-sm dark:text-white focus:ring-1 focus:ring-[#4B0082]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-none shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 bg-gray-900 text-white flex justify-between items-center border-b border-gray-800">
             <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-[#FFD700]" />
                <h3 className="font-black text-xs uppercase tracking-[0.25em]">Master Security Registry</h3>
             </div>
             <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Verified Gate Access Index</span>
          </div>
          <div className="overflow-x-auto no-scrollbar">
             <table className="w-full text-left">
                <thead>
                   <tr className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">
                      <th className="px-6 py-5">Node ID</th>
                      <th className="px-6 py-5">Visitor Identity</th>
                      <th className="px-6 py-5">Host Official</th>
                      <th className="px-6 py-5">Purpose of Visit</th>
                      <th className="px-6 py-5 text-center">Protocol Time</th>
                      <th className="px-6 py-5 text-center">Access Status</th>
                      <th className="px-6 py-5 text-right">Gate Actions</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                   {filteredVisitors.map((vis) => (
                      <tr key={vis.id} className="hover:bg-purple-50/20 dark:hover:bg-gray-700/20 transition-all group">
                         <td className="px-6 py-5 font-mono text-xs font-bold text-[#4B0082] dark:text-purple-300">{vis.id}</td>
                         <td className="px-6 py-5">
                            <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">{vis.name}</p>
                         </td>
                         <td className="px-6 py-5">
                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">{vis.host}</p>
                         </td>
                         <td className="px-6 py-5">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 italic">"{vis.purpose}"</span>
                         </td>
                         <td className="px-6 py-5 text-center">
                            <div className="flex flex-col items-center">
                               <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">In: {vis.checkIn}</span>
                               {vis.checkOut && <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Out: {vis.checkOut}</span>}
                            </div>
                         </td>
                         <td className="px-6 py-5 text-center">
                            <span className={`px-3 py-1 rounded-none text-[9px] font-black uppercase tracking-widest border ${
                               vis.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 
                               'bg-gray-50 text-gray-500 border-gray-200 opacity-60'
                             }`}>
                               {vis.status === 'Active' ? 'ON-SITE' : 'CHECKED OUT'}
                             </span>
                         </td>
                         <td className="px-6 py-5 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               {vis.status === 'Active' && (
                                 <button 
                                   onClick={() => handleCheckOut(vis.id)}
                                   className="p-2 text-emerald-600 hover:bg-emerald-50 rounded" title="Check Out"
                                 >
                                   <LogOut size={16}/>
                                 </button>
                               )}
                               <button onClick={() => handleDeleteVisitor(vis.id)} className="p-2 text-gray-300 hover:text-red-500" title="Purge Record"><Trash2 size={16}/></button>
                            </div>
                         </td>
                      </tr>
                   ))}
                   {filteredVisitors.length === 0 && (
                      <tr><td colSpan={7} className="py-24 text-center text-gray-400 font-black uppercase tracking-[0.4em] text-sm italic">Zero (0) Security Records Identified in Ledger Search</td></tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#1a0033]/95 backdrop-blur-3xl p-4">
             <div className="bg-white dark:bg-gray-900 w-full max-w-xl shadow-2xl border-t-[8px] border-[#4B0082] overflow-hidden flex flex-col animate-slide-up">
                <div className="bg-gray-900 p-8 border-b-2 border-[#FFD700] flex justify-between items-center text-white">
                   <div>
                      <h3 className="text-xl font-bold uppercase tracking-tight">Register Guest Entry</h3>
                      <p className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest mt-1">BMI Institutional Security Node</p>
                   </div>
                   <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-red-500 transition-all text-white"><X size={24}/></button>
                </div>

                <form onSubmit={handleRegister} className="p-10 space-y-8 bg-[#FAFAFA] dark:bg-gray-950">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Visitor Full Name</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Official Identification Name"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-bold text-sm uppercase tracking-tight focus:border-[#4B0082]"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Host Entity / Official to Visit</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Dr. Samuel Kiptoo"
                        value={formData.host}
                        onChange={e => setFormData({...formData, host: e.target.value})}
                        className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-bold text-sm focus:border-[#4B0082]"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Specific Purpose of Access</label>
                      <textarea 
                        required
                        rows={2}
                        value={formData.purpose}
                        onChange={e => setFormData({...formData, purpose: e.target.value})}
                        placeholder="Institutional activity description..."
                        className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-medium text-sm focus:border-[#4B0082] resize-none"
                      ></textarea>
                   </div>
                   <div className="flex flex-col gap-5 pt-4">
                      <button 
                        type="submit"
                        className="w-full py-5 bg-[#4B0082] text-white rounded-none shadow-2xl font-black uppercase tracking-[0.2em] text-xs border border-[#FFD700]/30 hover:bg-black transition-all flex items-center justify-center gap-4"
                      >
                        <CheckCircle2 size={18} className="text-[#FFD700]" /> Authorize Site Entry
                      </button>
                      <button type="button" onClick={() => setIsModalOpen(false)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors">Abort Access Request</button>
                   </div>
                </form>
             </div>
          </div>
        )}

        <div className="bg-gray-900 border-l-4 border-[#FFD700] p-6 text-white flex items-start gap-5 shadow-2xl">
           <div className="p-2 bg-[#FFD700] text-black shadow-lg"><ShieldAlert size={20}/></div>
           <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FFD700]">Campus Security Policy Enforcement</p>
              <p className="text-xs text-gray-300 mt-1">
                 Entry to BMI University premises is subject to mandatory registration. Visitor logs are stored for audit purposes. All guests must display temporary identification while on institutional grounds.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Visitors;









