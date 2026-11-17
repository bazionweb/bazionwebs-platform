import React, { useState } from 'react';
import { AiIcon, PaperAirplaneIcon } from './Icons';
import { TextAreaField } from './FormControls';
import { generateWithGemini } from '../services/geminiClient';

const suggestions = [
  'A reminder for our weekly prayer meeting this Wednesday.',
  'An announcement about our upcoming youth camp next month.',
  'A thank you message to the volunteers who helped with the Easter event.',
  "An invitation to a special guest speaker's sermon this Sunday.",
  'A call for donations for the new building fund.',
];

const AiFeaturesPage: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt) {
      setError('Please enter a topic for the announcement.');
      return;
    }
    setIsLoading(true);
    setGeneratedContent('');
    setError('');

    try {
      const fullPrompt = `You are a helpful assistant for HKM MINISTRIES. Your task is to write a warm, clear, and concise church announcement suitable for a bulletin or to be read aloud. The announcement should be based on the following topic: "${prompt}". Keep it under 150 words.`;

      const text = await generateWithGemini(fullPrompt, { model: 'gemini-2.5-flash' });

      if (text) {
        setGeneratedContent(text);
      } else {
        setError("Sorry, the AI couldn't generate a message at this time. Please try a different prompt.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(e);
      setError(msg || 'An error occurred while connecting to the AI service. Please check your setup and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-100 shadow">
        <h1 className="text-3xl font-bold text-gray-800">AI Announcement Assistant</h1>
        <p className="mt-1 text-gray-600">Let AI help you draft church announcements, reminders, and messages.</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
        <h2 className="text-xl font-semibold text-gray-700 flex items-center">
          <AiIcon className="h-6 w-6 mr-2 text-purple-600" />
          Step 1: Provide a Topic
        </h2>
        <TextAreaField
          label="What should the announcement be about?"
          placeholder="e.g., A reminder for our weekly prayer meeting this Wednesday."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Or try a suggestion:</h4>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setPrompt(suggestion)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center disabled:bg-gray-400"
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
              <PaperAirplaneIcon className="h-5 w-5 mr-2" />
            )}
            {isLoading ? 'Generating...' : 'Generate Announcement'}
          </button>
        </div>
      </div>

      {(isLoading || generatedContent || error) && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Step 2: Review & Copy</h2>
          {isLoading && <p className="text-gray-500">Generating your announcement...</p>}
          {error && <p className="text-red-600 bg-red-50 p-3 rounded-md">{error}</p>}
          {generatedContent && (
            <div className="bg-gray-50 p-4 rounded-md border space-y-4">
              <p className="text-gray-800 whitespace-pre-wrap">{generatedContent}</p>
              <button
                onClick={() => navigator.clipboard.writeText(generatedContent)}
                className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
              >
                Copy to Clipboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiFeaturesPage;
