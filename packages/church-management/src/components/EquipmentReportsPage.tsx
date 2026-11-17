import React, { useMemo } from 'react';
import { ArrowLeftIcon, ReportsIcon, EquipmentIcon, CurrencyDollarIcon, CheckCircleIcon } from './Icons';
import { Equipment } from './equipmentData';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface EquipmentReportsPageProps {
  onBack: () => void;
  equipment: Equipment[];
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string }> = ({
  title,
  value,
  icon: Icon,
  color,
}) => (
  <div className={`p-4 rounded-lg shadow-md flex items-center text-white ${color}`}>
    <div className="p-3 bg-white/20 rounded-full mr-4">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-sm uppercase font-semibold">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

const PIE_COLORS = ['#34d399', '#f59e0b', '#60a5fa', '#a78bfa', '#f472b6', '#ec4899', '#14b8a6'];

const EquipmentReportsPage: React.FC<EquipmentReportsPageProps> = ({ onBack, equipment }) => {
  const stats = useMemo(() => {
    const totalValue = equipment.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    const totalItems = equipment.length;
    const excellentCount = equipment.filter((e) => e.condition === 'Excellent').length;
    const goodCount = equipment.filter((e) => e.condition === 'Good').length;
    const needsAttentionCount = equipment.filter((e) => e.condition === 'Needs Attention').length;
    return { totalValue, totalItems, excellentCount, goodCount, needsAttentionCount };
  }, [equipment]);

  const valueByCategory = useMemo(() => {
    const categoryMap = new Map<string, number>();
    equipment.forEach((item) => {
      const currentVal = categoryMap.get(item.category) || 0;
      categoryMap.set(item.category, currentVal + (item.purchasePrice || 0));
    });
    return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  }, [equipment]);

  const countByCategory = useMemo(() => {
    const categoryMap = new Map<string, number>();
    equipment.forEach((item) => {
      categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
    });
    return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  }, [equipment]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Equipment Reports</h1>
          <p className="mt-1 text-gray-600">Analyze equipment data and generate reports.</p>
        </div>
        <button
          onClick={onBack}
          className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Equipment Value"
          value={`KSH ${stats.totalValue.toLocaleString()}`}
          icon={CurrencyDollarIcon}
          color="bg-green-500"
        />
        <StatCard title="Total Items" value={stats.totalItems.toString()} icon={EquipmentIcon} color="bg-blue-500" />
        <StatCard
          title="Excellent Condition"
          value={`${stats.excellentCount} / ${stats.goodCount}`}
          icon={CheckCircleIcon}
          color="bg-sky-500"
        />
        <StatCard
          title="Needs Attention"
          value={stats.needsAttentionCount.toString()}
          icon={ReportsIcon}
          color="bg-yellow-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Value by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={valueByCategory} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => `KSH ${value.toLocaleString()}`} />
              <Bar dataKey="value" name="Total Value" fill="#10b981" barSize={30} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Items by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={countByCategory}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
              >
                {countByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '14px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default EquipmentReportsPage;
