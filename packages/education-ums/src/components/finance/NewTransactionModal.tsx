import React from 'react';
import { X, DollarSign, Calendar, CheckCircle2 } from '../../shims/lucide-react';
import { Transaction, Student, StaffMember } from '../../types';

interface NewTransactionModalProps {
  isNewTxModalOpen: boolean;
  setIsNewTxModalOpen: (open: boolean) => void;
  editingTx: Transaction | null;
  setEditingTx: (tx: Transaction | null) => void;
  financeView: 'students' | 'employees';
  newTx: any;
  setNewTx: (tx: any) => void;
  handleAddTx: (e: React.FormEvent) => void;
  students: Student[];
  staff: StaffMember[];
  keepOpen: boolean;
  setKeepOpen: (keep: boolean) => void;
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isNewTxModalOpen, setIsNewTxModalOpen, editingTx, setEditingTx, financeView, newTx, setNewTx, handleAddTx, students, staff, keepOpen, setKeepOpen
}) => {
  return (
    <>
      {isNewTxModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#1a0033]/90 backdrop-blur-3xl p-4">
            {/* New Transaction Modal Content ... */}
            <div className="bg-white dark:bg-gray-900 shadow-2xl w-full max-w-lg border border-[#FFD700]/30 animate-slide-up overflow-hidden flex flex-col">
              <div className="bg-gray-900 p-8 border-b-2 border-[#FFD700] flex justify-between items-center text-white">
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">
                    {editingTx
                      ? "Update Entry"
                      : financeView === "students"
                        ? "Fee Collection Portal"
                        : "Payroll Disbursement"}
                  </h3>
                  <p className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest mt-1">
                    BMI Financial Gateway Node
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsNewTxModalOpen(false);
                    setEditingTx(null);
                  }}
                  className="p-2 hover:bg-red-500 transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddTx} className="p-10 space-y-8">
                {/* ... Form Fields ... */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                    {financeView === "students"
                      ? "Select Student Registry"
                      : "Select Employee Entity"}
                  </label>
                  <select
                    required
                    value={newTx.name}
                    onChange={(e) =>
                      setNewTx({ ...newTx, name: e.target.value })
                    }
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none outline-none font-bold text-sm focus:ring-1 focus:ring-[#4B0082] appearance-none cursor-pointer"
                  >
                    <option value="">
                      {financeView === "students"
                        ? "--- Select Student ---"
                        : "--- Select Staff ---"}
                    </option>
                    {financeView === "students"
                      ? students
                          .sort((a, b) =>
                            `${a.first_name} ${a.last_name}`.localeCompare(
                              `${b.first_name} ${b.last_name}`,
                            ),
                          )
                          .map((s) => (
                            <option
                              key={s.id}
                              value={`${s.first_name} ${s.last_name}`}
                            >
                              {s.id} | {s.first_name} {s.last_name}
                            </option>
                          ))
                      : staff
                          .sort((a, b) =>
                            (a.name ?? "").localeCompare(b.name ?? ""),
                          )
                          .map((st) => (
                            <option key={st.id} value={st.name}>
                              {st.id} | {st.name}
                            </option>
                          ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                      Transaction Code
                    </label>
                    <select
                      value={newTx.desc}
                      onChange={(e) =>
                        setNewTx({ ...newTx, desc: e.target.value })
                      }
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none outline-none font-bold text-xs uppercase tracking-tight"
                    >
                      {financeView === "students" ? (
                        <>
                          <option>Tuition Payment</option>
                          <option>Hostel Fee</option>
                          <option>Library Fine</option>
                          <option>Exam Retake Fee</option>
                        </>
                      ) : (
                        <>
                          <option>Salary Disbursement</option>
                          <option>Institutional Grant</option>
                          <option>Academic Research Allowance</option>
                          <option>Overtime Wage</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                      Transaction Status
                    </label>
                    <select
                      value={newTx.status}
                      onChange={(e) =>
                        setNewTx({ ...newTx, status: e.target.value as "Paid" | "Pending" | "Failed" })
                      }
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none outline-none font-bold text-xs uppercase tracking-tight"
                    >
                      <option value="Paid">Committed (Paid)</option>
                      <option value="Pending">Await Validation</option>
                      <option value="Failed">Declined / Error</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                      Amount In USD ($)
                    </label>
                    <div className="relative">
                      <DollarSign
                        size={20}
                        className="absolute left-5 top-1/2 -translate-y-1/2 text-[#4B0082]"
                      />
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={newTx.amt}
                        onChange={(e) =>
                          setNewTx({ ...newTx, amt: e.target.value })
                        }
                        placeholder="0.00"
                        className="w-full pl-12 pr-5 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none outline-none font-black text-xl text-[#4B0082]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                      Effective Date
                    </label>
                    <div className="relative">
                      <Calendar
                        size={18}
                        className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        required
                        type="date"
                        value={newTx.date}
                        onChange={(e) =>
                          setNewTx({ ...newTx, date: e.target.value })
                        }
                        className="w-full pl-12 pr-5 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none outline-none font-bold text-xs dark:text-white uppercase tracking-tight"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-5 pt-4">
                  <button
                    type="submit"
                    className="w-full py-5 bg-[#4B0082] text-white rounded-none shadow-2xl font-black uppercase tracking-[0.2em] text-xs border border-[#FFD700]/30 hover:bg-black transition-all flex items-center justify-center gap-4"
                  >
                    <CheckCircle2 size={18} className="text-[#FFD700]" />
                    {editingTx
                      ? "Update Ledger Commit"
                      : financeView === "students"
                        ? "Record Payment Entry"
                        : "Authorize Payroll"}
                  </button>

                  {!editingTx && (
                    <div className="flex items-center justify-center gap-3">
                      <input
                        type="checkbox"
                        id="keepOpen"
                        checked={keepOpen}
                        onChange={(e) => setKeepOpen(e.target.checked)}
                        className="w-4 h-4 cursor-pointer accent-[#4B0082]"
                      />
                      <label
                        htmlFor="keepOpen"
                        className="text-[10px] font-black uppercase text-gray-500 tracking-widest cursor-pointer select-none"
                      >
                        Stay in Gateway after submission (Batch Processing)
                      </label>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        
    </>
  );
};
