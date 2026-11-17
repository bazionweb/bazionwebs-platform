import React, { useState } from 'react';
import { ArrowLeftIcon, PaperAirplaneIcon, AiIcon, CheckCircleIcon, XCircleIcon } from './Icons';
import { Member } from './memberData';
import { TextAreaField } from './FormControls';
import type { AttendanceRecord } from './attendanceData';
import { generateWithGemini } from '../services/geminiClient';
import { smsService } from '../services/smsService';

interface ServiceDetailsPageProps {
  serviceName: string;
  serviceDate: string;
  serviceRecords: AttendanceRecord[];
  members: Member[];
  onBack: () => void;
}

const ServiceDetailsPage: React.FC<ServiceDetailsPageProps> = ({
  serviceName,
  serviceDate,
  serviceRecords,
  members,
  onBack,
}) => {
  const [smsTarget, setSmsTarget] = useState<'Present' | 'Absent' | null>(null);
  const [message, setMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const presentMembers = serviceRecords.filter((r) => r.status === 'Present' || r.status === 'Late');
  const absentMembers = serviceRecords.filter((r) => r.status === 'Absent');

  const handleGenerateMessage = async (status: 'Present' | 'Absent') => {
    setIsGenerating(true);
    setMessage('');
    try {
      const prompt =
        status === 'Present'
          ? "You are a friendly church pastor for HKM MINISTRIES. Write a short, warm, and congratulatory SMS message (under 160 characters) to thank a member for attending today's service. Start the message with 'Hi [Name],'. Mention how their presence is a blessing to the church family."
          : "You are a caring church pastor for HKM MINISTRIES. Write a short, encouraging SMS message (under 160 characters) to a member who was absent from today's service. Start the message with 'Hi [Name],'. Let them know they were missed and that the church is praying for them. Avoid sounding guilt-tripping.";

      const text = await generateWithGemini(prompt, { model: 'gemini-2.5-flash' });

      if (text) {
        setMessage(text.replace(/"/g, ''));
      } else {
        setMessage("Sorry, I couldn't generate a message at this time.");
      }
    } catch (error) {
      console.error('Error generating message:', error);
      setMessage('Error: Could not connect to the AI service.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    setIsSending(true);
    setSendSuccess(false);

    try {
      const targetRecords = smsTarget === 'Present' ? presentMembers : absentMembers;

      // Get phone numbers of target members
      const recipients = targetRecords
        .map((record) => {
          const member = members.find((m) => m.name.toLowerCase() === record.memberName.toLowerCase());
          return member ? member.phone : null;
        })
        .filter((phone) => phone !== null) as string[];

      if (recipients.length === 0) {
        alert('No members found with phone numbers in this list.');
        setIsSending(false);
        return;
      }

      const result = await smsService.sendSms(recipients, message);

      if (result.success) {
        setSendSuccess(true);
        setTimeout(() => {
          setSmsTarget(null);
          setMessage('');
          setSendSuccess(false);
        }, 3000);
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to send', error);
      alert('An unexpected error occurred.');
    } finally {
      setIsSending(false);
    }
  };

  const SmsComposer = () => {
    if (!smsTarget) return null;

    const targetCount = smsTarget === 'Present' ? presentMembers.length : absentMembers.length;
    const title = smsTarget === 'Present' ? 'Send Appreciation SMS' : 'Send Encouragement SMS';
    const description = `This message will be sent to all ${targetCount} ${smsTarget.toLowerCase()} members from this service.`;

    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border mt-6 animate-fade-in-up">
        <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
        <p className="text-sm text-gray-500 mb-4">{description}</p>

        <div className="space-y-4">
          <div>
            <TextAreaField
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Click 'Generate with AI' or type your message here..."
              rows={5}
            />
            <p className="text-xs text-gray-500 mt-1">
              The `[Name]` placeholder will be automatically replaced with each member's name upon sending.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <button
              onClick={() => handleGenerateMessage(smsTarget)}
              disabled={isGenerating}
              className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-purple-100 text-purple-700 font-semibold rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-wait"
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
                <AiIcon className="h-5 w-5 mr-2" />
              )}
              {isGenerating ? 'Generating...' : 'Generate with AI'}
            </button>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setSmsTarget(null)}
                className="w-full bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={isSending || !message || targetCount === 0}
                className="w-full bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center disabled:bg-gray-400"
              >
                {isSending ? (
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                )}
                {isSending ? 'Sending...' : `Send to ${targetCount} Members`}
              </button>
            </div>
          </div>
          {sendSuccess && (
            <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-lg text-center text-sm font-medium">
              Messages sent successfully! Check SMS History for details.
            </div>
          )}
        </div>
      </div>
    );
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'Present':
        return (
          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>
        );
      case 'Absent':
        return <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
      case 'Late':
        return (
          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>
        );
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-1 rounded-full">{status}</span>;
    }
  };

  const getMemberDepartment = (memberName: string) => {
    const member = members.find((m) => m.name.toLowerCase() === memberName.toLowerCase());
    return member ? member.department : 'N/A';
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-white shadow-sm border">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Attendance Details</h1>
            <p className="mt-1 text-gray-600 font-semibold">
              {serviceName} - {new Date(serviceDate).toDateString()}
            </p>
          </div>
          <button onClick={onBack} className="flex items-center text-sm text-purple-600 hover:underline font-semibold">
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <p>{serviceRecords.length} members marked</p>
        </div>
        <div className="overflow-auto max-h-[40vh]">
          <table className="w-full text-sm text-left text-gray-500 relative">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Member Name
                </th>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Department
                </th>
                <th scope="col" className="px-6 py-3 bg-gray-50">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {serviceRecords.map((record) => (
                <tr key={record.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900 capitalize">{record.memberName}</td>
                  <td className="px-6 py-4">{getMemberDepartment(record.memberName)}</td>
                  <td className="px-6 py-4">{getStatusChip(record.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
          <div className="flex items-center justify-center text-green-600">
            <CheckCircleIcon className="w-6 h-6 mr-2" />
            <h3 className="text-xl font-bold">{presentMembers.length}</h3>
          </div>
          <p className="text-sm text-green-800 font-medium mb-3">Present / Late Members</p>
          <button
            onClick={() => setSmsTarget('Present')}
            className="bg-green-600 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-green-700 w-full disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={smsTarget !== null || presentMembers.length === 0}
          >
            Send Appreciation SMS
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-center">
          <div className="flex items-center justify-center text-red-600">
            <XCircleIcon className="w-6 h-6 mr-2" />
            <h3 className="text-xl font-bold">{absentMembers.length}</h3>
          </div>
          <p className="text-sm text-red-800 font-medium mb-3">Absent Members</p>
          <button
            onClick={() => setSmsTarget('Absent')}
            className="bg-red-600 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-red-700 w-full disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={smsTarget !== null || absentMembers.length === 0}
          >
            Send Encouragement SMS
          </button>
        </div>
      </div>

      <SmsComposer />
    </div>
  );
};

export default ServiceDetailsPage;
