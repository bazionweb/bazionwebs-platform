import React, { useEffect, useState } from 'react';
import { MapPin, User, Plus } from '../shims/lucide-react';
import { authFetch } from '../services/authService';
import { API_URL } from '../services/config';

interface Schedule {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  expand?: {
    course_id?: { code: string; title: string };
    instructor_id?: { name: string };
    classroom_id?: { name: string };
  };
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 12 }, (_, i) => `${i + 8}:00`);

const Timetable: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [, setIsLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState({ course_id: '', day_of_week: 'Monday', start_time: '08:00', end_time: '09:00', classroom_id: '', instructor_id: '' });

  const load = async () => {
    try {
      const res = await authFetch(`${API_URL}/timetabling`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setSchedules(data.data);
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.course_id || !form.day_of_week || !form.start_time || !form.end_time) return;
    const method = editing ? 'PATCH' : 'POST';
    const url = editing ? `${API_URL}/timetabling/${editing.id}` : `${API_URL}/timetabling`;
    const res = await authFetch(url, { method, body: JSON.stringify(form) });
    if (res.ok) {
      const data = await res.json();
      if (data.success) setSchedules(Array.isArray(data.data) ? data.data : []);
    }
    setModal(false);
    setEditing(null);
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this session?')) return;
    await authFetch(`${API_URL}/timetabling/${id}`, { method: 'DELETE' });
    await load();
  };

  const getSchedulesForSlot = (day: string, hour: string) => {
    return schedules.filter(s => {
      const startHour = parseInt(s.start_time.split(':')[0]);
      const slotHour = parseInt(hour.split(':')[0]);
      return s.day_of_week === day && startHour === slotHour;
    });
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex-shrink-0 sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-6 py-3 shadow-sm flex justify-between items-center">
        <div className="pl-14">
          <h1 className="text-lg font-black text-[#2E004F] dark:text-white uppercase tracking-tighter">
            Academic Timetable
          </h1>
          <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-widest">
            Weekly Schedule & Resource Allocation
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setForm({ course_id: '', day_of_week: 'Monday', start_time: '08:00', end_time: '09:00', classroom_id: '', instructor_id: '' }); setModal(true); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#4B0082] text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
        >
          <Plus size={12} className="text-[#FFD700]" />
          Add Session
        </button>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto p-6">
        <div className="min-w-[800px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-r border-gray-100 dark:border-gray-700"></div>
            {DAYS.map(day => (
              <div key={day} className="p-4 text-center font-black text-[10px] uppercase tracking-widest text-gray-400 border-r border-gray-100 dark:border-gray-700 last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Time Slots */}
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700 last:border-b-0 h-24">
              <div className="p-2 bg-gray-50 dark:bg-gray-900 border-r border-gray-100 dark:border-gray-700 flex items-center justify-center">
                <span className="text-[10px] font-black text-gray-400">{hour}</span>
              </div>
              {DAYS.map(day => {
                const slots = getSchedulesForSlot(day, hour);
                return (
                  <div key={`${day}-${hour}`} className="p-1 border-r border-gray-100 dark:border-gray-700 last:border-r-0 relative group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    {slots.map(s => (
                      <div key={s.id} className="h-full w-full bg-purple-50 dark:bg-purple-900/20 border-l-4 border-[#4B0082] p-2 flex flex-col justify-between overflow-hidden">
                        <div>
                          <p className="text-[9px] font-black text-[#4B0082] dark:text-purple-300 uppercase truncate">
                            {s.expand?.course_id?.code}
                          </p>
                          <p className="text-[8px] font-bold text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {s.expand?.course_id?.title}
                          </p>
                        </div>
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => { setEditing(s); setForm({ course_id: (s as any).course_id || '', day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, classroom_id: (s as any).classroom_id || '', instructor_id: (s as any).instructor_id || '' }); setModal(true); }} className="text-[8px] font-bold underline">Edit</button>
                          <button onClick={() => remove(s.id)} className="text-[8px] font-bold underline text-red-600">Del</button>
                        </div>
                        <div className="flex flex-col gap-0.5 mt-auto">
                          <div className="flex items-center gap-1 text-[7px] font-bold text-gray-400 uppercase">
                            <MapPin size={8} /> {s.expand?.classroom_id?.name || 'TBA'}
                          </div>
                          <div className="flex items-center gap-1 text-[7px] font-bold text-gray-400 uppercase">
                            <User size={8} /> {s.expand?.instructor_id?.name || 'Staff'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {modal && (
        <form onSubmit={save} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-2 text-sm">
            <h3 className="font-black uppercase">{editing ? 'Edit Session' : 'Add Session'}</h3>
            <input required placeholder="Course ID" value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })} className="w-full border rounded p-2" />
            <select value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: e.target.value })} className="w-full border rounded p-2">{DAYS.map(d => <option key={d} value={d}>{d}</option>)}</select>
            <div className="grid grid-cols-2 gap-2">
              <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className="border rounded p-2" />
              <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className="border rounded p-2" />
            </div>
            <input placeholder="Classroom" value={form.classroom_id} onChange={e => setForm({ ...form, classroom_id: e.target.value })} className="w-full border rounded p-2" />
            <input placeholder="Instructor ID" value={form.instructor_id} onChange={e => setForm({ ...form, instructor_id: e.target.value })} className="w-full border rounded p-2" />
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setModal(false)}>Cancel</button><button className="px-4 py-1.5 bg-[#4B0082] text-white rounded">Save</button></div>
          </div>
        </form>
      )}
    </div>
  );
};

export default Timetable;









