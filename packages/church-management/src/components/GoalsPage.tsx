import React, { useState, useMemo } from 'react';
import { PlusIcon } from './Icons';
import { attendanceData } from './attendanceData';

const initialGoals = [
  {
    id: 1,
    title: 'Achieve 85% attendance for Sunday Morning Service in April',
    target: 85,
    service: 'Sunday Morning Service',
    month: 3,
    year: 2025,
  },
  {
    id: 2,
    title: 'Keep Sunday School absences below 5 members',
    target: 5,
    department: 'Children',
    type: 'absences_below',
    month: 3,
    year: 2025,
  },
];

interface Goal {
  id: number;
  title: string;
  target: number;
  service?: string;
  department?: string;
  type?: string;
  month: number;
  year: number;
}

const GoalCard: React.FC<{ goal: Goal }> = ({ goal }) => {
  const progress = useMemo(() => {
    if (goal.type === 'absences_below') {
      const records = attendanceData.filter((r) => {
        const recordDate = new Date(r.date);
        return recordDate.getMonth() === goal.month && recordDate.getFullYear() === goal.year && r.status === 'Absent';
      });
      const services = new Set(records.map((r) => r.date)).size;
      const avgAbsences = services > 0 ? records.length / services : 0;
      // Progress is how close we are to the target from the opposite direction
      return avgAbsences > goal.target ? 0 : (1 - avgAbsences / goal.target) * 100;
    } else {
      // Default percentage goal
      const records = attendanceData.filter((r) => {
        const recordDate = new Date(r.date);
        return (
          recordDate.getMonth() === goal.month && recordDate.getFullYear() === goal.year && r.service === goal.service
        );
      });
      const attended = records.filter((r) => r.status === 'Present' || r.status === 'Late').length;
      return records.length > 0 ? (attended / records.length) * 100 : 0;
    }
  }, [goal]);

  const progressWidth = Math.min(progress, 100);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <p className="font-semibold text-gray-700">{goal.title}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500">Progress</span>
        <span className="text-xs font-bold text-green-600">{progress.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
        <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${progressWidth}%` }}></div>
      </div>
      <div className="text-right mt-2 text-xs text-gray-500">
        Target: {goal.target}
        {goal.type !== 'absences_below' ? '%' : ''}
      </div>
    </div>
  );
};

const GoalsPage: React.FC = () => {
  const [goals] = useState(initialGoals);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-700">Attendance Goals</h2>
          <p className="text-sm text-gray-500">Set and track attendance goals to encourage growth.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center shadow hover:bg-green-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" /> {showForm ? 'Cancel' : 'Set New Goal'}
        </button>
      </div>
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Create a New Goal</h3>
          <form className="space-y-4">
            <input
              type="text"
              placeholder="Goal Title (e.g., Increase mid-week attendance)"
              className="w-full p-2 border rounded-md"
            />
            <div className="grid grid-cols-2 gap-4">
              <select className="w-full p-2 border rounded-md">
                <option>Sunday Morning Service</option>
                <option>Mid-week Service</option>
              </select>
              <input type="number" placeholder="Target % (e.g., 80)" className="w-full p-2 border rounded-md" />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600"
              >
                Save Goal
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
      </div>
    </div>
  );
};

export default GoalsPage;
