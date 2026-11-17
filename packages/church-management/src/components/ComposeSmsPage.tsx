import React, { useState, useMemo } from 'react';
import { ArrowLeftIcon, PaperAirplaneIcon, AiIcon } from './Icons';
import { Member } from './memberData';
import { Group } from './GroupsManagementPage';
import { SmsRecord } from './smsData';
import { TextAreaField, SelectField } from './FormControls';
import AiGenerateSmsModal from './AiGenerateSmsModal';
import { generateWithGemini } from '../services/geminiClient';
import { smsService } from '../services/smsService';
import { storage } from '../services/storage';

interface ComposeSmsPageProps {
  members: Member[];
  groups: Group[];
  onBack: () => void;
  onLogSms: (record: Omit<SmsRecord, 'id'>) => Promise<void>;
}

const messageTemplates = {
  'Sunday Service Reminder': 'Dear Member, we remind you of tomorrow at 9:00 AM. God bless you.',
  'Mid-week Service Reminder':
    'Hello {first_name}, a reminder of our mid-week service tomorrow at 7 PM. Hope to see you there!',
  'Special Event':
    'Greetings! Our special event is happening this Saturday. Check the church website for more details.',
};

const ComposeSmsPage: React.FC<ComposeSmsPageProps> = ({ members, groups: _groups, onBack, onLogSms }) => {
  const [activeTab, setActiveTab] = useState<'individual' | 'group' | 'all'>('individual');
  const [selectedMembers, setSelectedMembers] = useState(new Set<string>());

  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [template, setTemplate] = useState('');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const filteredMembers = useMemo(() => {
    if (!searchTerm) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.phone && m.phone.includes(searchTerm)) ||
        (m.email && m.email.toLowerCase().includes(searchTerm.toLowerCase())),
    );
  }, [members, searchTerm]);

  const handleSelectMember = (memberId: string) => {
    setSelectedMembers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) newSet.delete(memberId);
      else newSet.add(memberId);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    // Only select members with phone numbers
    const membersWithPhone = filteredMembers.filter((m) => m.phone);
    if (selectedMembers.size === membersWithPhone.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(membersWithPhone.map((m) => m.id)));
    }
  };

  const recipientCount = useMemo(() => {
    if (activeTab === 'all') return members.length;
    if (activeTab === 'group') return '...'; // Needs logic to count members in selected groups
    return selectedMembers.size;
  }, [activeTab, selectedMembers, members]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setTemplate(val);
    if (val && messageTemplates[val as keyof typeof messageTemplates]) {
      setMessage(messageTemplates[val as keyof typeof messageTemplates]);
    }
  };

  const handleGenerateMessage = async (prompt: string) => {
    if (!prompt) {
      alert('Please enter a prompt for the AI.');
      return;
    }

    setIsGenerating(true);
    try {
      const apiKey = await storage.getApiKey();
      if (!apiKey) {
        alert('Please configure the AI API Key in Settings first.');
        setIsGenerating(false);
        return;
      }

      const fullPrompt = `You are a friendly church pastor for HKM MINISTRIES. Write a short, concise SMS message (under 160 characters) based on the following instruction: "${prompt}". Make it sound warm and personal. Do not include placeholders like [Name] unless specified in the user's instruction.`;

      const text = await generateWithGemini(fullPrompt, { model: 'gemini-2.5-flash' });

      if (text) {
        setMessage(text.replace(/"/g, ''));
        setIsAiModalOpen(false);
      } else {
        alert('The AI could not generate a message. Please try again.');
      }
    } catch (error) {
      console.error('Error generating message:', error);
      alert('An error occurred while connecting to the AI service. Please check your API key and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (recipientCount === 0) {
      alert('Please select at least one recipient.');
      return;
    }
    if (!message) {
      alert('Please enter a message.');
      return;
    }

    setIsSending(true);

    try {
      // Collect recipient phone numbers (only members with phone numbers)
      const recipients =
        activeTab === 'all'
          ? members.filter((m) => m.phone).map((m) => m.phone!)
          : Array.from(selectedMembers)
              .map((id) => members.find((m) => m.id === id)?.phone)
              .filter((phone): phone is string => Boolean(phone));

      if (recipients.length === 0) {
        alert('No members with phone numbers selected. Please select members who have phone numbers.');
        setIsSending(false);
        return;
      }

      const result = await smsService.sendSms(recipients, message);

      if (result.success) {
        // Log to Supabase
        await onLogSms({
          recipientCount: recipients.filter(Boolean).length,
          message: message,
          status: 'Sent',
          date: new Date().toISOString().split('T')[0],
        });
        alert(result.message);
        onBack();
      } else {
        alert(`Failed to send: ${result.message}`);
      }
    } catch (error) {
      console.error('SMS Error', error);
      alert('An error occurred while sending SMS.');
    } finally {
      setIsSending(false);
    }
  };

  const getMemberDetails = (member: Member) => {
    const details: string[] = [];
    if (member.department) details.push(member.department);
    if (member.role === 'Leader') details.push('Leader');
    return details.join(' • ');
  };

  return (
    <form onSubmit={handleSend} className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Compose SMS</h1>
          <p className="mt-1 text-gray-600">Create and send messages to your members.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Select Recipients</h3>
          <div className="border-b mb-4">
            <nav className="flex -mb-px space-x-6">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'all' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:border-gray-300'}`}
              >
                All Members ({members.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('group')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'group' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:border-gray-300'}`}
              >
                By Group (0 selected)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('individual')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'individual' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:border-gray-300'}`}
              >
                Individual ({selectedMembers.size} selected)
              </button>
            </nav>
          </div>
          {activeTab === 'individual' && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Search Members"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm px-4 py-2"
              />
              <div className="flex justify-between items-center text-sm">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filteredMembers.length > 0 && selectedMembers.size === filteredMembers.length}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-green-600"
                  />
                  <span className="ml-2 font-medium">Select All</span>
                </label>
                <span>{filteredMembers.length} members found</span>
              </div>
              <div className="max-h-60 overflow-y-auto border rounded-lg p-2 space-y-2">
                {filteredMembers
                  .filter((member) => member.phone) // Only show members with phone numbers
                  .map((member) => (
                    <label
                      key={member.id}
                      className={`flex items-center p-2 rounded-md hover:bg-gray-50 cursor-pointer ${selectedMembers.has(member.id) ? 'bg-green-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.has(member.id)}
                        onChange={() => handleSelectMember(member.id)}
                        className="h-4 w-4 rounded border-gray-300 text-green-600"
                      />
                      <div className="ml-3 flex-1">
                        <p className="font-medium text-gray-800 capitalize">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.phone}</p>
                      </div>
                      <span className="text-xs text-gray-400 capitalize">{getMemberDetails(member)}</span>
                    </label>
                  ))}
                {filteredMembers.filter((m) => m.phone).length === 0 && (
                  <p className="text-sm text-gray-500 text-center p-4">No members with phone numbers found</p>
                )}
              </div>
            </div>
          )}
          {activeTab === 'group' && <p className="text-center text-gray-500 py-10">Group selection is coming soon!</p>}
          {activeTab === 'all' && (
            <p className="text-center text-gray-500 py-10">Message will be sent to all {members.length} members.</p>
          )}
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Message Content</h3>
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center text-sm font-semibold text-purple-600 hover:text-purple-800"
            >
              <AiIcon className="h-4 w-4 mr-1" />
              Generate with AI
            </button>
          </div>
          <div className="space-y-4">
            <SelectField
              name="template"
              label="Message Templates"
              options={Object.keys(messageTemplates)}
              value={template}
              onChange={handleTemplateChange}
            />
            <div>
              <TextAreaField
                label="Message Content *"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
              />
              <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                <span>Use {'{first_name}'} to personalize</span>
                <span>{message.length} characters (Max 1000)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSending}
          className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSending ? (
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
          {isSending ? 'Sending...' : 'Send SMS'}
        </button>
      </div>
      {isAiModalOpen && (
        <AiGenerateSmsModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          onGenerate={handleGenerateMessage}
          isLoading={isGenerating}
        />
      )}
    </form>
  );
};

export default ComposeSmsPage;
