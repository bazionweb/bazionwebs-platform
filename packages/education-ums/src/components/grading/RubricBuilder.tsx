import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, FileText, ChevronRight } from '../../shims/lucide-react';
import { authFetch } from '../../services/authService';
import { API_URL } from '../../services/config';

interface Criterion {
  id: string;
  description: string;
  max_points: number;
  weight: number;
}

interface Rubric {
  id: string;
  title: string;
  description?: string;
  course_id: string;
  criteria: Criterion[];
  total_points: number;
}

const RubricBuilder: React.FC = () => {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [activeRubric, setActiveRubric] = useState<Partial<Rubric> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadRubrics();
  }, []);

  const loadRubrics = async () => {
    try {
      const res = await authFetch(`${API_URL}/rubrics`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setRubrics(data.data);
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error(error);
     }
  };

  const handleAddCriterion = () => {
    if (!activeRubric) return;
    const newCriterion: Criterion = {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      max_points: 0,
      weight: 0,
    };
    setActiveRubric({
      ...activeRubric,
      criteria: [...(activeRubric.criteria || []), newCriterion]
    });
  };

  const handleSave = async () => {
    if (!activeRubric) return;
    setIsLoading(true);
    try {
      const res = await authFetch(`${API_URL}/rubrics`, {
        method: 'POST',
        body: JSON.stringify(activeRubric),
      });
      if (res.ok) {
        alert("Rubric saved successfully");
        setActiveRubric(null);
        loadRubrics();
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error(error);
     } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="flex-shrink-0 sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-6 py-3 shadow-sm flex justify-between items-center">
        <div className="pl-14">
          <h1 className="text-lg font-black text-[#2E004F] dark:text-white uppercase tracking-tighter">
            Marking Rubrics
          </h1>
          <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-widest">
            Structured Assessment Criteria & Weighting
          </p>
        </div>
        {!activeRubric && (
          <button 
            onClick={() => setActiveRubric({ title: '', criteria: [], total_points: 100 })}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#4B0082] text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
          >
            <Plus size={12} className="text-[#FFD700]" />
            New Rubric
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeRubric ? (
          <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 border-2 border-[#4B0082] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-black text-xl uppercase tracking-tighter text-[#4B0082] dark:text-purple-300">
                {activeRubric.id ? 'Edit Rubric' : 'Create New Rubric'}
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveRubric(null)}
                  className="px-4 py-2 border border-gray-200 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isLoading}
                  className="px-4 py-2 bg-[#4B0082] text-white text-[10px] font-black uppercase tracking-widest hover:bg-black flex items-center gap-2"
                >
                  <Save size={12} /> Save Rubric
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Rubric Title</label>
                <input 
                  type="text" 
                  value={activeRubric.title}
                  onChange={e => setActiveRubric({...activeRubric, title: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 font-bold outline-none focus:border-[#4B0082]"
                  placeholder="e.g. Final Project Assessment"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-gray-400">Criteria</label>
                  <button 
                    onClick={handleAddCriterion}
                    className="text-[#4B0082] font-black text-[10px] uppercase flex items-center gap-1 hover:underline"
                  >
                    <Plus size={12} /> Add Criterion
                  </button>
                </div>

                <div className="space-y-3">
                  {activeRubric.criteria?.map((c, idx) => (
                    <div key={c.id} className="grid grid-cols-12 gap-3 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 group">
                      <div className="col-span-6">
                        <input 
                          type="text" 
                          placeholder="Description"
                          value={c.description}
                          onChange={e => {
                            const newCriteria = [...(activeRubric.criteria || [])];
                            newCriteria[idx].description = e.target.value;
                            setActiveRubric({...activeRubric, criteria: newCriteria});
                          }}
                          className="w-full bg-transparent font-bold text-xs outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <input 
                          type="number" 
                          placeholder="Max Pts"
                          value={c.max_points}
                          onChange={e => {
                            const newCriteria = [...(activeRubric.criteria || [])];
                            newCriteria[idx].max_points = parseInt(e.target.value);
                            setActiveRubric({...activeRubric, criteria: newCriteria});
                          }}
                          className="w-full bg-transparent font-bold text-xs text-center outline-none border-b border-gray-200 focus:border-[#4B0082]"
                        />
                      </div>
                      <div className="col-span-2">
                        <input 
                          type="number" 
                          placeholder="Weight %"
                          value={c.weight}
                          onChange={e => {
                            const newCriteria = [...(activeRubric.criteria || [])];
                            newCriteria[idx].weight = parseInt(e.target.value);
                            setActiveRubric({...activeRubric, criteria: newCriteria});
                          }}
                          className="w-full bg-transparent font-bold text-xs text-center outline-none border-b border-gray-200 focus:border-[#4B0082]"
                        />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button 
                          onClick={() => {
                            const newCriteria = activeRubric.criteria?.filter(item => item.id !== c.id);
                            setActiveRubric({...activeRubric, criteria: newCriteria});
                          }}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rubrics.map(r => (
              <div key={r.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all group cursor-pointer" onClick={() => setActiveRubric(r)}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-[#4B0082]">
                    <FileText size={20} />
                  </div>
                  <h3 className="font-black text-xs uppercase tracking-widest text-gray-900 dark:text-white truncate">
                    {r.title}
                  </h3>
                </div>
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{r.criteria.length} Criteria</p>
                    <p className="text-lg font-black text-[#4B0082] dark:text-purple-300">{r.total_points} PTS</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-[#4B0082] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RubricBuilder;









