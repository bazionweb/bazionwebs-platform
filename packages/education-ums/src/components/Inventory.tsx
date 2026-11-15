import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, 
  
  AlertTriangle, 
  Plus, 
  Search, 
  Layers, 
  
  BarChart, 
  X, 
  CheckCircle2, 
  Trash2, 
  Edit, 
  
  
  ShieldAlert,
  MapPin
} from '../shims/lucide-react';
import { useApiDataStore } from '../stores/apiDataStore';
import { useDialogStore } from '../stores/dialogStore';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  condition: 'New' | 'Good' | 'Fair' | 'Poor';
  location: string;
  lastUpdated: string;
}

const Inventory: React.FC = () => {
  const {
    inventoryItems: items,
    fetchInventory,
    createInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
  } = useApiDataStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'ICT',
    qty: '',
    condition: 'New' as InventoryItem['condition'],
    location: '',
  });

  const categories = ['All', 'ICT', 'Science Lab', 'Furniture', 'Office', 'Theology Artifacts', 'General'];

  useEffect(() => {
    fetchInventory();
  }, []);

  const filteredItems = useMemo(() => {
    return (items || []).filter(item => {
      const matchesSearch = 
        (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.location || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, categoryFilter]);

  const stats = useMemo(() => ({
    totalAssets: items.length,
    newCondition: items.filter(i => i.condition === 'New').length,
    poorCondition: items.filter(i => i.condition === 'Poor').length,
    valuation: items.reduce((acc, curr) => acc + ((curr.quantity || 0) * 10), 0)
  }), [items]);

  const handleOpenModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        qty: item.quantity.toString(),
        condition: item.condition,
        location: item.location || '',
      });
    } else {
      setEditingItem(null);
      setFormData({ name: '', category: 'ICT', qty: '', condition: 'New', location: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = parseInt(formData.qty) || 0;
    
    if (editingItem) {
      const success = await updateInventoryItem(editingItem.id, {
        name: formData.name,
        category: formData.category,
        quantity: qtyNum,
        condition: formData.condition,
        location: formData.location,
      });
      if (success) {
        setIsModalOpen(false);
      } else {
        await useDialogStore.getState().alert({
          title: "Inventory Update Failed",
          message: "The system was unable to update this asset record in the institutional inventory ledger. Please try again.",
          variant: "warning",
          confirmText: "Understood",
          badgeText: "Facilities Management",
        });
      }
    } else {
      const success = await createInventoryItem({
        name: formData.name,
        category: formData.category,
        quantity: qtyNum,
        condition: formData.condition,
        location: formData.location,
      });
      if (success) {
        setIsModalOpen(false);
      } else {
        await useDialogStore.getState().alert({
          title: "Asset Registration Failed",
          message: "The system was unable to register this asset in the institutional inventory ledger. Please try again.",
          variant: "warning",
          confirmText: "Understood",
          badgeText: "Facilities Management",
        });
      }
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await useDialogStore.getState().confirm({
      title: "Permanent Asset Decommission",
      message: "Are you sure you want to permanently decommission and purge this asset from the institutional inventory ledger?",
      detail: "This will permanently remove the asset record including its condition history, location tracking, and procurement data. This action must be authorised by the Facilities Management Director and is subject to institutional asset disposal policy.",
      confirmText: "Decommission Asset",
      cancelText: "Retain Asset",
      variant: "danger",
      badgeText: "Facilities Protocol",
    });
    if (confirmed) {
      const success = await deleteInventoryItem(id);
      if (!success) {
        await useDialogStore.getState().alert({
          title: "Decommission Failed",
          message: "The asset could not be removed from the inventory ledger. Please contact the Facilities Management Office.",
          variant: "warning",
          confirmText: "Close",
          badgeText: "Facilities Management",
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
              <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white tracking-tight uppercase leading-tight">Asset & Inventory Control</h2>
              <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">BMI Institutional Property & Procurement Ledger</p>
           </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
           <button 
             onClick={() => handleOpenModal()}
             className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-[#4B0082] text-white rounded-lg shadow-md hover:bg-black transition-all font-bold text-[9px] sm:text-[10px] uppercase tracking-wider border border-[#FFD700]/30 cursor-pointer"
           >
            <Plus size={12} className="text-[#FFD700]" /> New Procurement Entry
          </button>
        </div>
      </div>

      {/* Responsive Tab Bar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
         <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
            <Layers size={13} />
            <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Categories</span>
         </div>
         {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                categoryFilter === cat 
                  ? 'bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50' 
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]'
              }`}
            >
              {cat}
            </button>
         ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-purple-500">
             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fixed Asset Registry</h4>
             <div className="flex items-end justify-between">
                <p className="text-3xl font-black text-[#4B0082] dark:text-white">{stats.totalAssets.toLocaleString()}</p>
                <Layers size={24} className="text-purple-300 opacity-50" />
             </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-emerald-500">
             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">New Condition Assets</h4>
             <div className="flex items-end justify-between">
                <p className="text-3xl font-black text-emerald-600">{stats.newCondition}</p>
                <CheckCircle2 size={24} className="text-emerald-300 opacity-50" />
             </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-red-500">
             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Poor Condition Assets</h4>
             <div className="flex items-end justify-between">
                <p className="text-3xl font-black text-red-500">{stats.poorCondition}</p>
                <AlertTriangle size={24} className="text-red-300 opacity-50" />
             </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-none shadow-sm border border-gray-100 dark:border-gray-700 border-l-4 border-l-blue-500">
             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Estimated Net Capital</h4>
             <div className="flex items-end justify-between">
                <p className="text-3xl font-black text-blue-600">${(stats.valuation * 12).toLocaleString()}</p>
                <BarChart size={24} className="text-blue-300 opacity-50" />
             </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 flex flex-col md:flex-row gap-4 items-center shadow-sm">
           <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Filter Inventory by Item Name, Category or Location..." 
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none outline-none font-bold text-sm dark:text-white focus:ring-1 focus:ring-[#4B0082]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-none shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 bg-gray-900 text-white flex justify-between items-center border-b border-gray-800">
             <div className="flex items-center gap-3">
                <Package size={18} className="text-[#FFD700]" />
                <h3 className="font-black text-xs uppercase tracking-[0.25em]">Master Asset Ledger</h3>
             </div>
             <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Verified Node Audit Index</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                     <th className="px-6 py-5">Asset Ref</th>
                     <th className="px-6 py-5">Item Specification</th>
                     <th className="px-6 py-5">Institutional Category</th>
                     <th className="px-6 py-5 text-center">Quantity</th>
                     <th className="px-6 py-5">Location</th>
                     <th className="px-6 py-5 text-center">Condition</th>
                     <th className="px-6 py-5 text-right">Commit Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-purple-50/20 dark:hover:bg-gray-700/20 transition-all group">
                       <td className="px-6 py-5 font-mono text-xs font-bold text-[#4B0082] dark:text-purple-300">{item.id}</td>
                       <td className="px-6 py-5 font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none text-sm">{item.name}</td>
                       <td className="px-6 py-5 text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">{item.category}</td>
                       <td className="px-6 py-5 text-center font-bold text-gray-700 dark:text-gray-300">{item.quantity}</td>
                       <td className="px-6 py-5 text-xs text-gray-500 font-bold uppercase tracking-widest">
                          <span className="flex items-center gap-1.5"><MapPin size={12}/>{item.location || 'N/A'}</span>
                       </td>
                       <td className="px-6 py-5 text-center">
                          <span className={`px-3 py-1 rounded-none text-[9px] font-black uppercase tracking-widest border ${
                            item.condition === 'New' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                            item.condition === 'Good' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                            item.condition === 'Fair' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                            'bg-red-50 text-red-700 border-red-200 animate-pulse'
                          }`}>
                            {item.condition}
                          </span>
                       </td>
                       <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => handleOpenModal(item)} className="p-2 text-gray-400 hover:text-[#4B0082] transition-colors"><Edit size={16}/></button>
                             <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                          </div>
                       </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr><td colSpan={7} className="py-24 text-center text-gray-400 font-black uppercase tracking-[0.4em] text-sm italic">Zero (0) Asset Records Identified in Query</td></tr>
                  )}
               </tbody>
            </table>
          </div>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#1a0033]/90 backdrop-blur-3xl p-4">
             <div className="bg-white dark:bg-gray-900 shadow-2xl w-full max-w-lg border border-[#FFD700]/30 animate-slide-up overflow-hidden flex flex-col">
                <div className="bg-gray-900 p-8 border-b-2 border-[#FFD700] flex justify-between items-center text-white">
                   <div>
                      <h3 className="text-xl font-bold uppercase tracking-tight">{editingItem ? 'Update Asset Record' : 'Institutional Procurement Entry'}</h3>
                      <p className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest mt-1">BMI Asset Lifecycle Node</p>
                   </div>
                   <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-red-500 transition-all text-white"><X size={24}/></button>
                </div>

                <form onSubmit={handleSave} className="p-10 space-y-8 bg-[#FAFAFA] dark:bg-gray-950">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Item Specification Name</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. Server Rack Units / Laboratory Beakers"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-bold text-sm uppercase tracking-tight focus:border-[#4B0082]"
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Institutional Category</label>
                         <select 
                           value={formData.category}
                           onChange={e => setFormData({...formData, category: e.target.value})}
                           className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none text-xs font-black uppercase cursor-pointer outline-none focus:border-[#4B0082]"
                         >
                            {categories.slice(1).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Current Condition Status</label>
                         <select 
                           value={formData.condition}
                            onChange={e => setFormData({...formData, condition: e.target.value as "New" | "Good" | "Fair" | "Poor"})}
                           className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none text-xs font-black uppercase cursor-pointer outline-none focus:border-[#4B0082]"
                         >
                            <option value="New">New / Sealed</option>
                            <option value="Good">Good / Operational</option>
                            <option value="Fair">Fair / Worn</option>
                            <option value="Poor">Poor / Needs Maintenance</option>
                         </select>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Quantity Magnitude</label>
                         <input 
                           required
                           type="number" 
                           placeholder="0"
                           value={formData.qty}
                           onChange={e => setFormData({...formData, qty: e.target.value})}
                           className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-black text-xl text-[#4B0082] dark:text-[#FFD700]"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Storage Location</label>
                         <input 
                           required
                           type="text" 
                           placeholder="e.g. Main Library / Lab B"
                           value={formData.location}
                           onChange={e => setFormData({...formData, location: e.target.value})}
                           className="w-full px-5 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-none outline-none font-bold text-sm uppercase tracking-tight focus:border-[#4B0082]"
                         />
                      </div>
                   </div>

                   <div className="flex flex-col gap-5 pt-4">
                      <button 
                        type="submit"
                        className="w-full py-5 bg-[#4B0082] text-white rounded-none shadow-2xl font-black uppercase tracking-[0.2em] text-xs border border-[#FFD700]/30 hover:bg-black transition-all flex items-center justify-center gap-4"
                      >
                        <CheckCircle2 size={18} className="text-[#FFD700]" /> {editingItem ? 'Authorize Record Commit' : 'Authorize Asset Registry'}
                      </button>
                      <button type="button" onClick={() => setIsModalOpen(false)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors">Discard Protocol</button>
                   </div>
                </form>
             </div>
          </div>
        )}

        <div className="bg-gray-900 border-l-4 border-[#FFD700] p-6 text-white flex items-start gap-5 shadow-2xl">
           <div className="p-2 bg-[#FFD700] text-black shadow-lg"><ShieldAlert size={20}/></div>
           <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FFD700]">Institutional Asset Protocol</p>
              <p className="text-xs text-gray-300 mt-1">
                 Registry nodes are synchronized with the Global Procurement Database. All fixed assets require unique BMI identification tags for physical verification cycles.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;









