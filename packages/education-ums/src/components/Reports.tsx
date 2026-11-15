
import React, { useState, useEffect, useMemo } from 'react';
import { 
  
  
  Users, 
  Wallet, 
  
  
  
  
  PieChart as 
  
  Zap, 
  Bot, 
  Loader2, 
  
  
  Sparkles,
  
  Clock
} from '../shims/lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area, 
  CartesianGrid,
  Legend
} from '../shims/recharts';
import { getAIResponse } from '../services/aiService';

const Reports: React.FC = () => {
  const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [activeRange, setActiveRange] = useState('Fiscal Year 2024');

  const [apiEnrollment, setApiEnrollment] = useState<any[]>([]);
  const [apiFinancialTrend, setApiFinancialTrend] = useState<any[]>([]);
  const [apiDepartmentalAllocation, setApiDepartmentalAllocation] = useState<any[]>([]);
  const [apiMetrics, setApiMetrics] = useState<{ yoyGrowth?: string; researchGrants?: string; studentRetention?: string; facultyRatio?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("../services/authService").then(({ authFetch }) => {
      import("../services/config").then(({ API_URL }) => {
        authFetch(`${API_URL}/stats/enrollment-by-faculty`)
          .then((r) => r.json())
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then((d: any) => {
            if (!cancelled && d.success && d.data) {
              if (Array.isArray(d.data.enrollment)) {
                setApiEnrollment(d.data.enrollment);
              }
              if (Array.isArray(d.data.financialTrend)) {
                setApiFinancialTrend(d.data.financialTrend);
              }
              if (Array.isArray(d.data.departmentalAllocation)) {
                setApiDepartmentalAllocation(d.data.departmentalAllocation);
              }
              if (d.data.metrics) {
                setApiMetrics(d.data.metrics);
              }
            }
          })
          .catch((_error) => {
            // eslint-disable-next-line no-console
            console.error("Failed to load statistics:", _error);
          });
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const enrollmentData = useMemo(() => {
    if (apiEnrollment.length > 0) return apiEnrollment;
    return [];
  }, [apiEnrollment]);

  const financialTrend = useMemo(() => {
    if (apiFinancialTrend.length > 0) return apiFinancialTrend;
    return [];
  }, [apiFinancialTrend]);

  const departmentalAllocation = useMemo(() => {
    if (apiDepartmentalAllocation.length > 0) return apiDepartmentalAllocation;
    return [];
  }, [apiDepartmentalAllocation]);

  const handleGenerateReport = async () => {
    setIsGeneratingAiReport(true);
    
    const enrollmentSummary = enrollmentData.length > 0
      ? enrollmentData.map((e: any) => `${e.name || e.faculty || 'Faculty'} (${e.val || e.value || e.count || 0})`).join(', ')
      : 'Data pending';

    const firstMonth = financialTrend.length > 0 ? financialTrend[0] : null;
    const lastMonth = financialTrend.length > 0 ? financialTrend[financialTrend.length - 1] : null;
    const financialSummary = (firstMonth && lastMonth)
      ? `Trend from ${firstMonth.month || 'Period Start'} ($${(firstMonth.revenue || firstMonth.income || 0).toLocaleString()}) to ${lastMonth.month || 'Period End'} ($${(lastMonth.revenue || lastMonth.income || 0).toLocaleString()})`
      : 'Financial data pending';

    const allocationSummary = departmentalAllocation.length > 0
      ? departmentalAllocation.slice(0, 2).map((d: any) => `${d.value || d.percent || 0}% ${d.name || d.department || 'Dept'}`).join(', ')
      : 'Allocation data pending';

    const prompt = `Generate a brief executive summary of the university's performance for ${activeRange}.
    Data:
    - Enrollment: ${enrollmentSummary}.
    - Financials: ${financialSummary}.
    - Resource Allocation: ${allocationSummary}.
    Highlight key growth areas and suggest one strategic improvement.`;
    
    try {
        const response = await getAIResponse(prompt, 'Institutional Data Analyst');
        setAiReport(response);
    } catch {
        setAiReport("Analysis generation failed. Please check network connectivity.");
    }
    setIsGeneratingAiReport(false);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      {/* Responsive Header */}
      <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex justify-between items-center shadow-xs">
         <div className="flex items-center gap-3 w-full">
            <div className="w-1.5 h-6 bg-[#FFD700] rounded-full flex-shrink-0"></div>
            <div>
               <h2 className="text-base sm:text-lg font-bold text-[#2E004F] dark:text-white uppercase leading-tight">Institutional Analytics</h2>
               <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Performance &amp; Fiscal Intelligence</p>
            </div>
         </div>
      </div>

      {/* Responsive Tab Bar */}
      <div className="bg-[#F8F9FA]/95 dark:bg-[#0a0015]/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs">
         <div className="flex items-center gap-1.5 mr-2 text-gray-400 flex-shrink-0">
            <Clock size={13} />
            <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Analysis Period</span>
         </div>
         {['Fiscal Year 2024', 'Q1 Performance', 'Q2 Performance', 'Academic Cycle A', 'Admissions Intake'].map((range) => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                activeRange === range 
                  ? 'bg-[#4B0082] text-white shadow-md shadow-purple-500/20 border border-purple-500/50' 
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#4B0082]'
              }`}
            >
              {range}
            </button>
         ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
         {/* AI Section */}
         <div className="bg-gradient-to-r from-[#4B0082] to-[#320064] p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10"><Bot size={120} /></div>
            <div className="relative z-10">
               <h3 className="text-lg font-black uppercase tracking-tight mb-2 flex items-center gap-2">
                  <Sparkles size={18} className="text-[#FFD700]" /> AI Executive Summary
               </h3>
               {aiReport ? (
                  <div className="bg-white/10 p-6 rounded-none backdrop-blur-sm border border-white/20 text-sm leading-relaxed font-medium">
                     {aiReport}
                  </div>
               ) : (
                  <p className="text-xs text-purple-200 max-w-xl mb-6">Generate a comprehensive natural language report based on real-time enrollment, financial, and departmental data matrices.</p>
               )}
               {!aiReport && (
                   <button 
                     onClick={handleGenerateReport}
                     disabled={isGeneratingAiReport}
                     className="mt-4 px-6 py-3 bg-[#FFD700] text-[#4B0082] font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2"
                   >
                      {isGeneratingAiReport ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      Generate Report
                   </button>
               )}
            </div>
         </div>

         {/* Charts Grid */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Financial */}
            <div className="bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-[400px] flex flex-col">
               <h4 className="text-xs font-black uppercase text-gray-500 mb-6 flex items-center gap-2"><Wallet size={14}/> Revenue vs Expenses</h4>
               <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={financialTrend}>
                        <defs>
                           <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4B0082" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#4B0082" stopOpacity={0}/>
                           </linearGradient>
                           <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <Tooltip />
                        <Area type="monotone" dataKey="revenue" stroke="#4B0082" fillOpacity={1} fill="url(#colorRev)" />
                        <Area type="monotone" dataKey="expenses" stroke="#EF4444" fillOpacity={1} fill="url(#colorExp)" />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Enrollment */}
            <div className="bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-[400px] flex flex-col">
               <h4 className="text-xs font-black uppercase text-gray-500 mb-6 flex items-center gap-2"><Users size={14}/> Enrollment by Faculty</h4>
               <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={enrollmentData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10, fontWeight: 700}} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: 'transparent'}} />
                        <Bar dataKey="val" fill="#4B0082" barSize={20} radius={[0, 4, 4, 0]} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>
         
         {/* Allocation Pie */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-[300px] flex flex-col">
                <h4 className="text-xs font-black uppercase text-gray-500 mb-6">Resource Allocation</h4>
                <div className="flex-1 w-full min-h-0">
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                         <Pie data={departmentalAllocation} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                            {departmentalAllocation.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                         </Pie>
                         <Tooltip />
                         <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" iconSize={8} wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                      </PieChart>
                   </ResponsiveContainer>
                </div>
             </div>
             
             {/* Key Metrics */}
             <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 border border-emerald-100 dark:border-emerald-800 flex flex-col justify-center">
                   <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">YoY Growth</p>
                   <p className="text-4xl font-black text-emerald-800 dark:text-emerald-400 mt-2">{apiMetrics?.yoyGrowth || '0.0%'}</p>
                   <p className="text-xs font-bold text-emerald-600/60 mt-1">Surpassing Projection</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/10 p-6 border border-blue-100 dark:border-blue-800 flex flex-col justify-center">
                   <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Research Grants / Revenue</p>
                   <p className="text-4xl font-black text-blue-800 dark:text-blue-400 mt-2">{apiMetrics?.researchGrants || 'GHS 0'}</p>
                   <p className="text-xs font-bold text-blue-600/60 mt-1">Secured Fiscal 2024</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/10 p-6 border border-amber-100 dark:border-amber-800 flex flex-col justify-center">
                   <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Student Retention</p>
                   <p className="text-4xl font-black text-amber-800 dark:text-amber-400 mt-2">{apiMetrics?.studentRetention || '0.0%'}</p>
                   <p className="text-xs font-bold text-amber-600/60 mt-1">Above National Avg</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/10 p-6 border border-purple-100 dark:border-purple-800 flex flex-col justify-center">
                   <p className="text-[10px] font-black uppercase text-purple-600 tracking-widest">Faculty Ratio</p>
                   <p className="text-4xl font-black text-purple-800 dark:text-purple-400 mt-2">{apiMetrics?.facultyRatio || '1:0'}</p>
                   <p className="text-xs font-bold text-purple-600/60 mt-1">Optimal Academic Density</p>
                </div>
             </div>
         </div>
      </div>
    </div>
  );
};

export default Reports;






