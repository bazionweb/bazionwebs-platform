import React from 'react';
import { useMessages } from '../hooks/useMessages';

const HelpdeskPage: React.FC = () => {
  const { messages, loading, error, updateMessage } = useMessages();

  if (loading) return <div className="p-6">Loading messages...</div>;
  if (error) return <div className="p-6 text-red-500">Error loading messages: {error.message}</div>;

  const handleMarkAsRead = async (id: string) => {
    await updateMessage(id, { status: 'Read' });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Helpdesk Messages</h1>
      <p className="text-gray-600 mb-6">Manage internal messages and tickets from church members.</p>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No messages found.
                </td>
              </tr>
            ) : (
              messages.map((msg) => (
                <tr key={msg.id} className={msg.status === 'Unread' ? 'bg-blue-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(msg.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{msg.department || 'General'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{msg.subject}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        msg.status === 'Unread'
                          ? 'bg-blue-100 text-blue-800'
                          : msg.status === 'Resolved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {msg.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {msg.status === 'Unread' && (
                      <button onClick={() => handleMarkAsRead(msg.id)} className="text-blue-600 hover:text-blue-900">
                        Mark Read
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HelpdeskPage;
