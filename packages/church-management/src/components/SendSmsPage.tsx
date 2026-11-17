import React, { useState } from 'react';
import { ArrowLeftIcon, PaperAirplaneIcon } from './Icons';
import { SelectField, TextAreaField } from './FormControls';

interface SendSmsPageProps {
  onBack: () => void;
}

const recipientGroups = ['All Members', 'Choir', 'Ushering Team', 'Media Department', 'Leaders'];

const SendSmsPage: React.FC<SendSmsPageProps> = ({ onBack }) => {
  const [message, setMessage] = useState('');
  const [recipientGroup, setRecipientGroup] = useState(recipientGroups[0]);
  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Send SMS Broadcast</h1>
        <button onClick={onBack} className="flex items-center text-sm text-green-600 hover:underline font-semibold">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Dashboard
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <p className="flex items-center text-green-700 font-medium">
            <PaperAirplaneIcon className="h-6 w-6 mr-2 p-1 bg-green-100 rounded-full" />
            Compose and send a message to church members
          </p>
        </div>
        <form className="space-y-6">
          <SelectField
            name="recipientGroup"
            label="Recipient Group"
            options={recipientGroups}
            required
            value={recipientGroup}
            onChange={(e) => setRecipientGroup(e.target.value)}
          />
          <div>
            <TextAreaField
              label="Message"
              placeholder="Type your message here..."
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
            />
            <div className="text-right text-sm text-gray-500 mt-1">
              {charCount} characters / {smsCount} SMS
            </div>
          </div>
          <div className="flex justify-end pt-6 border-t">
            <button
              type="button"
              onClick={onBack}
              className="bg-gray-200 text-gray-700 font-semibold py-2 px-6 rounded-lg mr-4 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center"
            >
              <PaperAirplaneIcon className="h-5 w-5 mr-2" />
              Send Message
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendSmsPage;
