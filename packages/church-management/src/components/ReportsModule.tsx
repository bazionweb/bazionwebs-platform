import React, { useState } from 'react';
import ReportsPage from './ReportsPage';
import GenerateReportPage from './GenerateReportPage';
import ReportViewer from './ReportViewer';
import { Member } from './memberData';
import { Transaction } from './financeData';
import { AttendanceRecord } from './attendanceData';

interface ReportsModuleProps {
  members: Member[];
  transactions: Transaction[];
  attendanceRecords: AttendanceRecord[];
}

const formatCurrency = (amount: number) =>
  `KSH ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // adjust when day is sunday
  return new Date(d.setDate(diff));
};

const ReportsModule: React.FC<ReportsModuleProps> = ({ members, transactions, attendanceRecords }) => {
  const [view, setView] = useState<'dashboard' | 'generate' | 'viewer'>('dashboard');
  const [reportContent, setReportContent] = useState<{
    title: string;
    columns: { Header: string; accessor: string }[];
    data: unknown[];
  }>({
    title: '',
    columns: [],
    data: [],
  });

  const handleBackToDashboard = () => setView('dashboard');

  const handleViewReport = (reportId: string) => {
    let title: string;
    let columns: { Header: string; accessor: string }[];
    let data: unknown[];

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    switch (reportId) {
      case 'members_new':
        title = 'New Members (Last 30 Days)';
        columns = [
          { Header: 'Name', accessor: 'name' },
          { Header: 'Phone', accessor: 'phone' },
          { Header: 'Email', accessor: 'email' },
          { Header: 'Date Added', accessor: 'dateAdded' },
        ];
        data = members.filter((m) => new Date(m.dateAdded) >= thirtyDaysAgo) as unknown as Member[];
        break;

      case 'members_birthdays':
        title = 'Birthdays This Month';
        columns = [
          { Header: 'Name', accessor: 'name' },
          { Header: 'Phone', accessor: 'phone' },
          { Header: 'Birthday', accessor: 'dob' },
          { Header: 'Department', accessor: 'department' },
        ];
        data = members.filter((m) => new Date(m.dob).getMonth() === currentMonth) as unknown as Member[];
        break;

      case 'members_by_dept': {
        title = 'Members by Department';
        columns = [
          { Header: 'Department', accessor: 'department' },
          { Header: 'Total Members', accessor: 'total' },
          { Header: 'Active Members', accessor: 'active' },
        ];
        const deptData = members.reduce(
          (acc, member) => {
            const dept = member.department || 'None';
            if (!acc[dept]) acc[dept] = { total: 0, active: 0 };
            acc[dept].total++;
            if (member.status === 'Active') acc[dept].active++;
            return acc;
          },
          {} as Record<string, { total: number; active: number }>,
        );
        data = Object.entries(deptData).map(([department, counts]: [string, { total: number; active: number }]) => ({
          department,
          ...counts,
        }));
        break;
      }

      case 'members_by_status': {
        title = 'Members by Status';
        columns = [
          { Header: 'Status', accessor: 'status' },
          { Header: 'Number of Members', accessor: 'count' },
        ];
        const statusData = members.reduce(
          (acc, member) => {
            acc[member.status] = (acc[member.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
        data = Object.entries(statusData).map(([status, count]) => ({ status, count }));
        break;
      }

      case 'attendance_weekly': {
        title = 'Weekly Attendance Summary';
        columns = [
          { Header: 'Week Of', accessor: 'week' },
          { Header: 'Total Attended', accessor: 'attended' },
          { Header: 'Services Held', accessor: 'services' },
          { Header: 'Average Attendance', accessor: 'average' },
        ];
        const weeklyData = attendanceRecords.reduce(
          (acc, record) => {
            const weekStart = getStartOfWeek(new Date(record.date));
            const weekKey = weekStart.toISOString().split('T')[0];
            if (!acc[weekKey]) acc[weekKey] = { attended: 0, services: new Set() };
            if (record.status === 'Present' || record.status === 'Late') {
              acc[weekKey].attended++;
            }
            acc[weekKey].services.add(`${record.date}-${record.service}`);
            return acc;
          },
          {} as Record<string, { attended: number; services: Set<string> }>,
        );
        data = Object.entries(weeklyData).map(
          ([week, stats]: [string, { attended: number; services: Set<string> }]) => ({
            week: new Date(week).toLocaleDateString(),
            attended: stats.attended,
            services: stats.services.size,
            average: (stats.attended / stats.services.size).toFixed(1),
          }),
        );
        break;
      }

      case 'attendance_monthly': {
        title = 'Monthly Attendance Summary';
        columns = [
          { Header: 'Month', accessor: 'month' },
          { Header: 'Total Attended', accessor: 'attended' },
          { Header: 'Services Held', accessor: 'services' },
          { Header: 'Average Attendance', accessor: 'average' },
        ];
        const monthlyData = attendanceRecords.reduce(
          (acc, record) => {
            const monthKey = record.date.substring(0, 7);
            if (!acc[monthKey]) acc[monthKey] = { attended: 0, services: new Set() };
            if (record.status === 'Present' || record.status === 'Late') acc[monthKey].attended++;
            acc[monthKey].services.add(`${record.date}-${record.service}`);
            return acc;
          },
          {} as Record<string, { attended: number; services: Set<string> }>,
        );
        data = Object.entries(monthlyData).map(
          ([monthKey, stats]: [string, { attended: number; services: Set<string> }]) => ({
            month: new Date(monthKey + '-02').toLocaleString('default', { month: 'long', year: 'numeric' }),
            attended: stats.attended,
            services: stats.services.size,
            average: (stats.attended / stats.services.size).toFixed(1),
          }),
        );
        break;
      }

      case 'attendance_by_service': {
        title = 'Attendance by Service Type';
        columns = [
          { Header: 'Service Type', accessor: 'service' },
          { Header: 'Total Attended', accessor: 'attended' },
          { Header: 'Times Held', accessor: 'held' },
          { Header: 'Average Attendance', accessor: 'average' },
        ];
        const serviceData = attendanceRecords.reduce(
          (acc, record) => {
            if (!acc[record.service]) acc[record.service] = { attended: 0, dates: new Set() };
            if (record.status === 'Present' || record.status === 'Late') acc[record.service].attended++;
            acc[record.service].dates.add(record.date);
            return acc;
          },
          {} as Record<string, { attended: number; dates: Set<string> }>,
        );
        data = Object.entries(serviceData).map(
          ([service, stats]: [string, { attended: number; dates: Set<string> }]) => ({
            service,
            attended: stats.attended,
            held: stats.dates.size,
            average: (stats.attended / stats.dates.size).toFixed(1),
          }),
        );
        break;
      }

      case 'attendance_comparison': {
        title = 'Attendance Comparison: This Month vs Last Month';
        columns = [
          { Header: 'Metric', accessor: 'metric' },
          { Header: 'This Month', accessor: 'thisMonth' },
          { Header: 'Last Month', accessor: 'lastMonth' },
          { Header: 'Change', accessor: 'change' },
        ];
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonth = lastMonthDate.getMonth();
        const lastMonthYear = lastMonthDate.getFullYear();

        const thisMonthRecords = attendanceRecords.filter(
          (r) => new Date(r.date).getMonth() === currentMonth && new Date(r.date).getFullYear() === currentYear,
        );
        const lastMonthRecords = attendanceRecords.filter(
          (r) => new Date(r.date).getMonth() === lastMonth && new Date(r.date).getFullYear() === lastMonthYear,
        );

        const getStats = (records: AttendanceRecord[]) => {
          const attended = records.filter((r) => r.status !== 'Absent').length;
          const services = new Set(records.map((r) => `${r.date}-${r.service}`)).size;
          return { attended, services, avg: services > 0 ? attended / services : 0 };
        };
        const thisMonthStats = getStats(thisMonthRecords);
        const lastMonthStats = getStats(lastMonthRecords);

        const getChange = (oldVal: number, newVal: number) => {
          if (oldVal === 0) return newVal > 0 ? '∞' : '0%';
          return `${(((newVal - oldVal) / oldVal) * 100).toFixed(1)}%`;
        };

        data = [
          {
            metric: 'Total Attended',
            thisMonth: thisMonthStats.attended,
            lastMonth: lastMonthStats.attended,
            change: getChange(lastMonthStats.attended, thisMonthStats.attended),
          },
          {
            metric: 'Services Held',
            thisMonth: thisMonthStats.services,
            lastMonth: lastMonthStats.services,
            change: getChange(lastMonthStats.services, thisMonthStats.services),
          },
          {
            metric: 'Average Attendance',
            thisMonth: thisMonthStats.avg.toFixed(1),
            lastMonth: lastMonthStats.avg.toFixed(1),
            change: getChange(lastMonthStats.avg, thisMonthStats.avg),
          },
        ];
        break;
      }

      case 'finance_monthly':
        title = `Monthly Income & Expenses for ${now.toLocaleString('default', { month: 'long' })} ${currentYear}`;
        columns = [
          { Header: 'Date', accessor: 'date' },
          { Header: 'Type', accessor: 'type' },
          { Header: 'Category', accessor: 'category' },
          { Header: 'Amount (KSH)', accessor: 'amount' },
          { Header: 'Description', accessor: 'description' },
        ];
        data = transactions
          .filter((t) => new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
          .map((t) => ({ ...t, amount: formatCurrency(t.amount) }));
        break;

      case 'finance_income_category': {
        title = 'Income by Category (All Time)';
        columns = [
          { Header: 'Category', accessor: 'category' },
          { Header: 'Total Income (KSH)', accessor: 'total' },
          { Header: 'Transactions', accessor: 'count' },
        ];
        const incomeData = transactions
          .filter((t) => t.type === 'Income')
          .reduce(
            (acc, t) => {
              if (!acc[t.category]) acc[t.category] = { total: 0, count: 0 };
              acc[t.category].total += t.amount;
              acc[t.category].count++;
              return acc;
            },
            {} as Record<string, { total: number; count: number }>,
          );
        data = Object.entries(incomeData).map(([category, stats]: [string, { total: number; count: number }]) => ({
          category,
          total: formatCurrency(stats.total),
          count: stats.count,
        }));
        break;
      }

      case 'finance_yearly': {
        title = `Yearly Financial Summary for ${currentYear}`;
        columns = [
          { Header: 'Month', accessor: 'month' },
          { Header: 'Total Income (KSH)', accessor: 'income' },
          { Header: 'Total Expenses (KSH)', accessor: 'expenses' },
          { Header: 'Net Balance (KSH)', accessor: 'net' },
        ];
        const yearlyData = transactions
          .filter((t) => new Date(t.date).getFullYear() === currentYear)
          .reduce(
            (acc, t) => {
              const monthKey = new Date(t.date).getMonth();
              if (!acc[monthKey]) acc[monthKey] = { income: 0, expenses: 0 };
              if (t.type === 'Income') acc[monthKey].income += t.amount;
              else acc[monthKey].expenses += t.amount;
              return acc;
            },
            [] as { income: number; expenses: number }[],
          );
        data = Array.from({ length: 12 }, (_, i) => {
          const monthStats = yearlyData[i] || { income: 0, expenses: 0 };
          const net = monthStats.income - monthStats.expenses;
          return {
            month: new Date(currentYear, i).toLocaleString('default', { month: 'long' }),
            income: formatCurrency(monthStats.income),
            expenses: formatCurrency(monthStats.expenses),
            net: formatCurrency(net),
          };
        });
        break;
      }

      default:
        alert(`Report "${reportId}" is not yet implemented.`);
        return;
    }

    setReportContent({ title, columns, data });
    setView('viewer');
  };

  const handleGenerateReport = (config: { type: string; start?: string; end?: string }) => {
    let title: string;
    let columns: { Header: string; accessor: string }[];
    let data: unknown[];
    const { type, start, end } = config;

    switch (type) {
      case 'Member List':
        title = `Member List Report${start && end ? ` (${start} to ${end})` : ''}`;
        columns = [
          { Header: 'Name', accessor: 'name' },
          { Header: 'Phone', accessor: 'phone' },
          { Header: 'Email', accessor: 'email' },
          { Header: 'Department', accessor: 'department' },
          { Header: 'Status', accessor: 'status' },
          { Header: 'Date Added', accessor: 'dateAdded' },
        ];
        data = members.filter((m) => {
          if (!start || !end) return true;
          return m.dateAdded >= start && m.dateAdded <= end;
        }) as unknown as Member[];
        break;

      case 'Attendance Summary':
        title = `Attendance Summary${start && end ? ` (${start} to ${end})` : ''}`;
        columns = [
          { Header: 'Date', accessor: 'date' },
          { Header: 'Service', accessor: 'service' },
          { Header: 'Member Name', accessor: 'memberName' },
          { Header: 'Status', accessor: 'status' },
        ];
        data = attendanceRecords.filter((r) => {
          if (!start || !end) return true;
          return r.date >= start && r.date <= end;
        });
        break;

      case 'Financial Statement':
        title = `Financial Statement${start && end ? ` (${start} to ${end})` : ''}`;
        columns = [
          { Header: 'Date', accessor: 'date' },
          { Header: 'Type', accessor: 'type' },
          { Header: 'Category', accessor: 'category' },
          { Header: 'Amount (KSH)', accessor: 'amount' },
          { Header: 'Description', accessor: 'description' },
        ];
        data = transactions
          .filter((t) => {
            if (!start || !end) return true;
            return t.date >= start && t.date <= end;
          })
          .map((t) => ({ ...t, amount: formatCurrency(t.amount) }));
        break;

      default:
        alert('Please select a valid report type.');
        return;
    }

    setReportContent({ title, columns, data });
    setView('viewer');
  };

  const renderView = () => {
    switch (view) {
      case 'generate':
        return (
          <GenerateReportPage
            onBack={handleBackToDashboard}
            onGenerate={handleGenerateReport}
            members={members}
            transactions={transactions}
            attendanceRecords={attendanceRecords}
          />
        );
      case 'viewer':
        return (
          <ReportViewer
            title={reportContent.title}
            columns={reportContent.columns}
            data={reportContent.data}
            onBack={handleBackToDashboard}
          />
        );
      case 'dashboard':
      default:
        return (
          <ReportsPage
            onGenerateClick={() => setView('generate')}
            onViewReport={handleViewReport}
            transactions={transactions}
            attendanceRecords={attendanceRecords}
          />
        );
    }
  };

  return <div>{renderView()}</div>;
};

export default ReportsModule;
