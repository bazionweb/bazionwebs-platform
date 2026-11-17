import React, { useState } from 'react';
import { PlusIcon, TrashIcon } from './Icons';

const initialReminders = [
  { id: 1, text: 'Follow up with members who missed 3 consecutive services', date: '2025-04-30', done: false },
  { id: 2, text: 'Prepare weekly attendance report for leadership meeting', date: '2025-04-25', done: true },
  { id: 3, text: 'Announce new attendance tracking system', date: '2025-05-01', done: false },
];

const RemindersPage: React.FC = () => {
  const [reminders, setReminders] = useState(initialReminders);
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderDate, setNewReminderDate] = useState('');

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText) return;
    const newReminder = {
      id: Date.now(),
      text: newReminderText,
      date: newReminderDate,
      done: false,
    };
    setReminders([newReminder, ...reminders]);
    setNewReminderText('');
    setNewReminderDate('');
  };

  const toggleDone = (id: number) => {
    setReminders(reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r)));
  };

  const deleteReminder = (id: number) => {
    setReminders(reminders.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-gray-700">Attendance Reminders</h2>
        <p className="text-sm text-gray-500">Manage your attendance-related tasks.</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Add New Reminder</h3>
        <form onSubmit={handleAddReminder} className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-grow w-full">
            <label className="text-sm font-medium text-gray-700">Task</label>
            <input
              type="text"
              value={newReminderText}
              onChange={(e) => setNewReminderText(e.target.value)}
              placeholder="e.g., Follow up with visitors"
              className="w-full mt-1 p-2 border rounded-md"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="text-sm font-medium text-gray-700">Due Date</label>
            <input
              type="date"
              value={newReminderDate}
              onChange={(e) => setNewReminderDate(e.target.value)}
              className="w-full mt-1 p-2 border rounded-md"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto bg-green-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center shadow hover:bg-green-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" /> Add
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-700">To-Do List</h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {reminders.map((reminder) => (
            <li
              key={reminder.id}
              className={`p-4 flex items-center justify-between ${reminder.done ? 'bg-gray-50' : ''}`}
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={reminder.done}
                  onChange={() => toggleDone(reminder.id)}
                  className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                />
                <div className="ml-4">
                  <p className={`font-medium ${reminder.done ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                    {reminder.text}
                  </p>
                  {reminder.date && (
                    <p className="text-sm text-gray-500">{new Date(reminder.date).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteReminder(reminder.id)}
                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </li>
          ))}
        </ul>
        {reminders.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>You have no reminders. Add one above!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemindersPage;
