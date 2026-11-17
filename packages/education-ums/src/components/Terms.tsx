import React, { useEffect, useState } from 'react';
import { Plus, Edit, X, CheckCircle2 } from '../shims/lucide-react';
import { getTerms, createTerm, updateTerm, closeTerm, Term } from '../services/termService';
import { useQueryClient } from '../shims/tanstack-react-query';

const Terms: React.FC = () => {
  const qc = useQueryClient();
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Term | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Term>>({
    name: '', code: '', academic_year: '', semester_number: 1,
    start_date: '', end_date: '', status: 'upcoming',
    registration_opens_at: '', registration_closes_at: '', census_date: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await getTerms();
      const data = res?.data ?? res?.success ? (res.data as Term[]) : [];
      setTerms(Array.isArray(data) ? data : []);
    } catch { /* keep empty */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const show = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };
  const refresh = async () => {
    await load();
    qc.invalidateQueries({ queryKey: ['terms'] });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', academic_year: '', semester_number: 1, start_date: '', end_date: '', status: 'upcoming', registration_opens_at: '', registration_closes_at: '', census_date: '' });
    setModal(true);
  };
  const openEdit = (t: Term) => {
    setEditing(t);
    setForm({ ...t });
    setModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) return;
    const clean: any = { ...form };
    for (const k of ['registration_opens_at', 'registration_closes_at', 'census_date']) if (!clean[k]) clean[k] = null;
    try {
      const res: any = editing ? await updateTerm(editing.id, clean) : await createTerm(clean);
      if (res?.success === false) throw new Error(res?.error || 'Save failed');
      setModal(false);
      await refresh();
      show(editing ? 'Term updated in database' : 'Term created in database');
    } catch (err: any) {
      show(err?.message || 'Save failed — check dates/window');
    }
  };

  const close = async (t: Term) => {
    if (!window.confirm(`Close term ${t.name}? This finalizes course completions (pass/fail) from grades.`)) return;
    try {
      await closeTerm(t.id);
      await refresh();
      show('Term closed — completions finalized');
    } catch (e: any) { show(e?.message || 'Close failed'); }
  };

  if (loading) return <div className="p-8 text-sm font-bold text-gray-500">Loading academic terms…</div>;

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-black uppercase">Academic Terms</h2>
          <p className="text-xs text-gray-500">Registration window + census date drive eligibility & census. Changes save instantly.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1 px-4 py-2 bg-[#4B0082] text-white text-xs font-bold rounded-lg"><Plus size={14} /> New Term</button>
      </div>
      <div className="grid gap-3">
        {terms.map(t => (
          <div key={t.id} className="bg-white dark:bg-gray-800 border p-4 rounded-xl flex justify-between items-center">
            <div>
              <div className="font-bold">{t.name} <span className="font-mono text-xs text-purple-700">{t.code}</span> <span className="text-[10px] uppercase bg-gray-100 px-2 py-0.5 rounded-full">{t.status}</span></div>
              <div className="text-xs text-gray-500">{t.start_date?.slice(0, 10)} → {t.end_date?.slice(0, 10)} · Reg: {t.registration_opens_at?.slice(0, 10) || '—'} → {t.registration_closes_at?.slice(0, 10) || '—'} · Census: {t.census_date?.slice(0, 10) || 'not set'}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(t)} className="px-3 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1"><Edit size={12} /> Edit</button>
              {t.status !== 'closed' && <button onClick={() => close(t)} className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-bold">Close + Finalize</button>}
            </div>
          </div>
        ))}
        {terms.length === 0 && <div className="text-sm text-gray-400">No terms yet — create the first term.</div>}
      </div>
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={save} className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3 text-sm">
            <div className="flex justify-between items-center border-b pb-2"><h3 className="font-black uppercase">{editing ? 'Edit Term' : 'New Term'}</h3><button type="button" onClick={() => setModal(false)}><X size={18} /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <label>Name*<input required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg p-2" /></label>
              <label>Code*<input required value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full border rounded-lg p-2 font-mono" /></label>
              <label>Academic year<input value={form.academic_year || ''} onChange={e => setForm({ ...form, academic_year: e.target.value })} className="w-full border rounded-lg p-2" placeholder="2025/2026" /></label>
              <label>Semester #<input type="number" value={form.semester_number ?? 1} onChange={e => setForm({ ...form, semester_number: Number(e.target.value) })} className="w-full border rounded-lg p-2" /></label>
              <label>Start<input type="date" required value={(form.start_date || '').slice(0, 10)} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full border rounded-lg p-2" /></label>
              <label>End<input type="date" required value={(form.end_date || '').slice(0, 10)} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full border rounded-lg p-2" /></label>
              <label>Status<select value={form.status || 'upcoming'} onChange={e => setForm({ ...form, status: e.target.value as any })} className="w-full border rounded-lg p-2">{['upcoming', 'registration', 'active', 'exam', 'grading', 'closed'].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
              <label>Census date<input type="date" value={(form.census_date || '').slice(0, 10)} onChange={e => setForm({ ...form, census_date: e.target.value })} className="w-full border rounded-lg p-2" /></label>
              <label>Reg opens<input type="date" value={(form.registration_opens_at || '').slice(0, 10)} onChange={e => setForm({ ...form, registration_opens_at: e.target.value })} className="w-full border rounded-lg p-2" /></label>
              <label>Reg closes<input type="date" value={(form.registration_closes_at || '').slice(0, 10)} onChange={e => setForm({ ...form, registration_closes_at: e.target.value })} className="w-full border rounded-lg p-2" /></label>
            </div>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setModal(false)} className="px-4 py-2">Cancel</button><button className="px-5 py-2 bg-[#2E004F] text-[#FFD700] rounded-lg font-bold">Save to Database</button></div>
          </form>
        </div>
      )}
      {toast && <div className="fixed bottom-6 right-6 bg-[#2E004F] text-[#FFD700] px-4 py-3 rounded-xl flex gap-2 items-center"><CheckCircle2 size={16} /><span className="text-xs font-bold">{toast}</span></div>}
    </div>
  );
};
export default Terms;
