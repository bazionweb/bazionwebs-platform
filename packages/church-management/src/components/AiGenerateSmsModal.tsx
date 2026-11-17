import React, { useState } from 'react';
import { AiIcon, XCircleIcon } from './Icons';

interface AiGenerateSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => Promise<void>;
  isLoading: boolean;
}

const suggestions = [
  'A reminder for Sunday service',
  'Welcome message for a new member',
  'A thank you message for volunteers',
  'An encouraging scripture for the week',
  'An announcement for a special event',
];

const AiGenerateSmsModal: React.FC<AiGenerateSmsModalProps> = ({ isOpen, onClose, onGenerate, isLoading }) => {
  const [prompt, setPrompt] = useState('');

  if (!isOpen) return null;

  const handleGenerateClick = () => {
    onGenerate(prompt);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <AiIcon className="h-6 w-6 mr-2 text-purple-600" />
            Generate Message with AI
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label htmlFor="ai-prompt" className="block text-sm font-medium text-gray-700 mb-1">
              What should the message be about?
            </label>
            <input
              id="ai-prompt"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A reminder for mid-week service"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">Keep it short and simple. The AI will write a concise SMS.</p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Or try a suggestion:</h4>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
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
            onClick={handleGenerateClick}
            disabled={isLoading || !prompt}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center disabled:bg-gray-400"
          >
            {isLoading ? (
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
              <AiIcon className="h-5 w-5 mr-2" />
            )}
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiGenerateSmsModal;
