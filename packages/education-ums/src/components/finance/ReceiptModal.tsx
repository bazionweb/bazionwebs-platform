import React from 'react';
import { ShieldAlert, Mail, MessageCircle, X } from '../../shims/lucide-react';
import { Transaction, Student } from '../../types';

interface ReceiptModalProps {
  showReceipt: Transaction | null;
  setShowReceipt: (tx: Transaction | null) => void;
  getReceiptData: (tx: Transaction) => { student?: Student | null; totalPaid: number; balance: number };
  sendReceipt: (recipient: string, type: 'single' | 'yearly' | 'total', amt?: number) => void;
  setShowToast: (show: boolean) => void;
  setToastMsg: (msg: string) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  showReceipt, setShowReceipt, getReceiptData, sendReceipt, setShowToast, setToastMsg
}) => {
  return (
    <>
      {showReceipt &&
          (() => {
            const { student, totalPaid, balance } = getReceiptData(showReceipt);
            return (
              <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4">
                {/* Receipt Content */}
                <div className="bg-white w-full max-w-2xl shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col border-[12px] border-white overflow-hidden animate-slide-up">
                  {/* ... Same as original ... */}
                  <div className="relative p-12 border-b-2 border-gray-900 overflow-hidden">
                    {/* ... Header ... */}
                    <div className="absolute top-0 right-0 p-4 font-mono text-[9px] text-gray-300 select-none uppercase tracking-widest">
                      Digital Authentication Matrix Active
                    </div>
                    <div className="flex justify-between items-start relative z-10">
                      <div className="flex items-center gap-6">
                        <img
                          src="/BMI.svg"
                          className="w-24 h-24 object-contain bg-white p-2 border border-gray-100 shadow-sm"
                          alt="Logo"
                        />
                        <div>
                          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase leading-none">
                            BMI UNIVERSITY
                          </h1>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-2">
                            Institutional Finance Division
                          </p>
                          <div className="mt-4 space-y-0.5 text-[9px] font-semibold text-gray-400 uppercase tracking-widest">
                            <p>980-259-3680 • bmiuniversities.org</p>
                            <p>East Africa Hub: +254 704 500 872</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase leading-none">
                          PAYMENT RECEIPT
                        </h2>
                        <p className="text-xs font-bold text-[#4B0082] mt-2">
                          REF: {showReceipt.ref}
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                          ISSUED: {showReceipt.date}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 p-12 relative overflow-hidden bg-[#FAFAFA]">
                    {/* ... Body ... */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] rotate-[-25deg] select-none scale-[1.5]">
                      <h1 className="text-[120px] font-black uppercase text-gray-900">
                        BMI UNIVERSITY
                      </h1>
                    </div>

                    <div className="grid grid-cols-2 gap-12 relative z-10">
                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                            RECIPIENT DOMAIN
                          </p>
                          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                            {showReceipt.name}
                          </h3>
                          <p className="text-xs font-bold text-[#4B0082] mt-1 italic">
                            {student?.id || "BMI-EXT-USR"}
                          </p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                            {student?.program_code || "External Audit"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                            PAYMENT SPECIFICATION
                          </p>
                          <p className="text-sm font-bold text-gray-700 uppercase tracking-tight">
                            {showReceipt.desc}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                            VIA: ELECTRONIC LEDGER TRANSFER
                          </p>
                        </div>
                      </div>

                      <div className="bg-white border-2 border-gray-900 p-8 flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase">
                              AMOUNT COMMITTED
                            </span>
                            <span className="text-sm font-black text-gray-900">
                              ${showReceipt.amt.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase">
                              CUMULATIVE PAID
                            </span>
                            <span className="text-sm font-black text-emerald-600">
                              ${totalPaid.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="pt-6">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                OUTSTANDING BALANCE
                              </p>
                              <p className="text-3xl font-black text-red-600 leading-none mt-1">
                                ${balance.toLocaleString()}
                              </p>
                            </div>
                            <div className="p-2 bg-gray-900 text-white rounded-none">
                              <ShieldAlert size={16} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-16 flex justify-between items-end relative z-10">
                      <div className="max-w-xs">
                        <p className="text-[9px] font-bold text-gray-400 uppercase leading-relaxed">
                          This document serves as an official electronic
                          confirmation of funds received into BMI University
                          accounts. Any discrepancy should be reported within 48
                          hours to the Bursary Office.
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="mb-2 font-['Brush_Script_MT',cursive] text-2xl text-[#4B0082] italic transform -rotate-2 select-none">
                          Institutional Registrar
                        </div>
                        <div className="w-48 h-[2px] bg-gray-900 mx-auto"></div>
                        <p className="text-[9px] font-black uppercase text-gray-900 mt-2 tracking-widest">
                          DIGITAL AUTHENTICATION SIGNATURE
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-10 border-t-2 border-gray-900 flex flex-wrap gap-4 items-center justify-between bg-white">
                    <div className="flex gap-4">
                      <button
                        onClick={() => {
                          setShowReceipt(null);
                          sendReceipt(
                            showReceipt.name,
                            "single",
                            showReceipt.amt,
                          );
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-[#4B0082] text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                      >
                        <Mail size={16} /> Dispatch via Email
                      </button>
                      <button
                        onClick={() => {
                          setShowReceipt(null);
                          setShowToast(true);
                          setToastMsg(
                            `Receipt Matrix shared to WhatsApp: ${showReceipt.ref}`,
                          );
                          setTimeout(() => setShowToast(false), 3000);
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"
                      >
                        <MessageCircle size={16} /> Share via WhatsApp
                      </button>
                    </div>
                    <button
                      onClick={() => setShowReceipt(null)}
                      className="p-3 bg-gray-100 hover:bg-red-500 hover:text-white transition-all rounded-none text-gray-400"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

        
    </>
  );
};
