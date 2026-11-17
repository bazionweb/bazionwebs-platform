import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Loader2, Sparkles } from '../shims/lucide-react';
import { getAIResponse } from '../services/aiService';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'ai';
  text: string;
}

const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Greetings. I am the BMI Institutional AI Advisor. I have full access to the ERP database including students, staff, finances, and assets. How can I assist you with administrative tasks today?' }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsThinking(true);

    const getLSCount = (key: string): number => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return 0;
            const data = JSON.parse(raw);
            return Array.isArray(data) ? data.length : 0;
        } catch { return 0; }
    };

    const systemData = {
        students: getLSCount('bmi_data_students'),
        staff: getLSCount('bmi_data_staff'),
        finance: getLSCount('bmi_data_transactions'),
        courses: getLSCount('bmi_data_courses'),
        library: getLSCount('bmi_data_library'),
    };

    const institutionalContext = `You are the BMI Portal AI Assistant. Institutional data summary: ${systemData.students} students, ${systemData.staff} staff, ${systemData.courses} courses, ${systemData.finance} transactions, ${systemData.library} library items. Answer questions based on general knowledge about university management. Do not reveal any personal information.`;

    // Convert messages to format expected by AI service
    const chatMessages = [
      { role: 'system' as const, content: institutionalContext },
      ...messages.map(m => ({ role: m.role === 'ai' ? 'assistant' as const : 'user' as const, content: m.text })),
      { role: 'user' as const, content: currentInput }
    ];
    
    const responseText = await getAIResponse(chatMessages);
    
    setMessages(prev => [...prev, { role: 'ai', text: responseText }]);
    setIsThinking(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#1a0033]/90 backdrop-blur-xl p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[85vh] rounded-none shadow-2xl flex flex-col border border-[#FFD700]/30 animate-slide-up overflow-hidden">
        
        {/* Header */}
        <div className="bg-gray-900 p-6 flex justify-between items-center border-b border-[#FFD700]/30">
           <div className="flex items-center gap-4">
              <div className="p-2 bg-[#FFD700] rounded-none shadow-[0_0_15px_rgba(255,215,0,0.5)]">
                 <Bot size={24} className="text-[#4B0082]" />
              </div>
              <div>
                 <h3 className="text-xl font-black text-white uppercase tracking-tight">BMI AI Advisor</h3>
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live ERP Database Connection Active</p>
                 </div>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-red-500 transition-all text-gray-400 hover:text-white rounded-full">
              <X size={24} />
           </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 dark:bg-black/20 no-scrollbar">
           {messages.map((msg, idx) => (
             <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                   <div className="w-10 h-10 rounded-none bg-[#4B0082] flex items-center justify-center flex-shrink-0 border border-[#FFD700]/30 shadow-lg mt-1">
                      <Sparkles size={18} className="text-[#FFD700]" />
                   </div>
                )}
                <div className={`max-w-[80%] p-5 rounded-none shadow-sm ${
                   msg.role === 'user' 
                     ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-r-4 border-r-[#4B0082]' 
                     : 'bg-[#4B0082] text-white border-l-4 border-l-[#FFD700]'
                }`}>
                   <div className="whitespace-pre-wrap text-sm leading-relaxed font-medium">
                      {msg.text.split('\n').map((line, i) => (
                        <p key={i} className={line.trim().endsWith(':') ? 'font-black uppercase tracking-widest opacity-80 mt-2' : ''}>
                           {line}
                        </p>
                      ))}
                   </div>
                </div>
                {msg.role === 'user' && (
                   <div className="w-10 h-10 rounded-none bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 border border-gray-300 dark:border-gray-600 shadow-lg mt-1">
                      <User size={18} className="text-gray-500 dark:text-gray-300" />
                   </div>
                )}
             </div>
           ))}
           {isThinking && (
             <div className="flex gap-4">
                <div className="w-10 h-10 rounded-none bg-[#4B0082] flex items-center justify-center flex-shrink-0 border border-[#FFD700]/30 shadow-lg mt-1">
                   <Bot size={18} className="text-[#FFD700] animate-pulse" />
                </div>
                <div className="bg-[#4B0082]/10 p-4 rounded-none flex items-center gap-3 border border-[#4B0082]/20">
                   <Loader2 size={16} className="text-[#4B0082] animate-spin" />
                   <span className="text-xs font-bold text-[#4B0082] uppercase tracking-widest">Analyzing Institutional Data...</span>
                </div>
             </div>
           )}
           <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
           <div className="relative flex items-center gap-4">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the AI about students, finances, staff, or request administrative actions..."
                className="w-full pl-6 pr-16 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-none outline-none focus:border-[#4B0082] focus:ring-0 text-sm font-medium resize-none shadow-inner h-16 dark:text-white"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-[#4B0082] text-white hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                 <Send size={18} className={input.trim() ? 'text-[#FFD700]' : 'text-gray-400'} />
              </button>
           </div>
           <div className="mt-2 text-center">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em]">
                 AI Generated Content - Verify Critical Data Against Master Ledgers
              </p>
           </div>
        </div>

      </div>
    </div>
  );
};

export default AIModal;








