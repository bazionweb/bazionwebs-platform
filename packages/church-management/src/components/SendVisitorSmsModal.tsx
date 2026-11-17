import React, { useState } from 'react';
import { Visitor } from './visitorData';
import { XCircleIcon, PaperAirplaneIcon, UserIcon, PhoneIcon } from './Icons';
import { TextAreaField } from './FormControls';
import { generateWithGemini } from '../services/geminiClient';

interface SendVisitorSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitor: Visitor;
}

const suggestions = [
  'A thank you for visiting',
  'An invitation to the next service',
  'A check-in to see how they are doing',
  'An encouraging word for their week',
];

const SendVisitorSmsModal: React.FC<SendVisitorSmsModalProps> = ({ isOpen, onClose, visitor }) => {
  const [message, setMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerateMessage = async (prompt: string) => {
    setIsGenerating(true);
    try {
      const fullPrompt = `You are a friendly church pastor for HKM MINISTRIES. Write a short, concise SMS message (under 160 characters) for a visitor named ${visitor.name}, based on this instruction: "${prompt}". Make it sound warm and personal.`;

      const text = await generateWithGemini(fullPrompt, { model: 'gemini-2.5-flash' });

      if (text) {
        setMessage(text.replace(/"/g, ''));
      } else {
        alert('The AI could not generate a message. Please try again.');
      }
    } catch (error) {
      console.error('Error generating message:', error);
      alert('An error occurred while connecting to the AI service.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = () => {
    alert(`SMS sent to ${visitor.name}!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <PaperAirplaneIcon className="h-6 w-6 mr-2 text-purple-600" />
            Send SMS to Visitor
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg border grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center">
              <UserIcon className="w-4 h-4 mr-2 text-gray-500" />
              <span className="font-semibold capitalize">{visitor.name}</span>
            </div>
            <div className="flex items-center">
              <PhoneIcon className="w-4 h-4 mr-2 text-gray-500" />
              <span>{visitor.phone}</span>
            </div>
          </div>
          <TextAreaField
            label="Message Content"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Type your message or generate with AI..."
          />
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Suggestions:</h4>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleGenerateMessage(suggestion)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-b-lg flex justify-end items-center gap-3">
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isGenerating || !message}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center disabled:bg-gray-400"
          >
            {isGenerating ? (
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <PaperAirplaneIcon className="h-5 w-5 mr-2" />
            )}
            {isGenerating ? 'Generating...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendVisitorSmsModal;
