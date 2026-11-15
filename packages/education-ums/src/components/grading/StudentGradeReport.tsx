/**
 * BMI UMS - Student Grade Report Component
 * Displays comprehensive grade report with GPA, academic standing, and trends
 */

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Award, AlertCircle } from '../../shims/lucide-react';
import { Grade, SemesterGPA, AcademicStanding } from '../../grading/types';
import { getStudentGrades } from '../../grading/services/GradeAPIService';
import { calculateSemesterGPA, calculateCumulativeGPA } from '../../grading/calculators/GPACalculator';
import { determineAcademicStanding } from '../../grading/engines/AcademicStandingEngine';

interface StudentGradeReportProps {
  studentId: string;
  studentName: string;
  isOpen: boolean;
  onClose: () => void;
}

const StudentGradeReport: React.FC<StudentGradeReportProps> = ({
  studentId,
  studentName,
  isOpen,
  onClose,
}) => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [semesterGPAs, setSemesterGPAs] = useState<SemesterGPA[]>([]);
  const [cumulativeGPA, setCumulativeGPA] = useState<number>(0);
  const [academicStanding, setAcademicStanding] = useState<AcademicStanding>(AcademicStanding.GOOD_STANDING);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && studentId) {
      loadStudentGrades();
    }
  }, [isOpen, studentId]);

  const loadStudentGrades = async () => {
    setIsLoading(true);
    try {
      const response = await getStudentGrades(studentId);
      if (response.success && response.data) {
        const studentGrades = response.data.items;
        setGrades(studentGrades);
        calculateGPAs(studentGrades);
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error('Failed to load student grades:', error);
     } finally {
      setIsLoading(false);
    }
  };

  const calculateGPAs = (studentGrades: Grade[]) => {
    // We need grading scales for calculation, using an empty map for now as a fallback
    const gradingScales = new Map();

    // Group grades by semester
    const semesterGroups = studentGrades.reduce((acc, grade) => {
      const key = `${grade.academicYear}-${grade.semester}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(grade);
      return acc;
    }, {} as Record<string, Grade[]>);

    // Calculate semester GPAs
    const semesterGPAResults: SemesterGPA[] = [];
    Object.entries(semesterGroups).forEach(([key, semesterGrades]) => {
      const [year, semester] = key.split('-');
      const gpaResult = calculateSemesterGPA(semesterGrades, gradingScales, year, semester);
      semesterGPAResults.push({
        ...gpaResult,
        academicYear: year,
        semester,
        studentId,
      });
    });

    setSemesterGPAs(semesterGPAResults.sort((a, b) => 
      `${a.academicYear}-${a.semester}`.localeCompare(`${b.academicYear}-${b.semester}`)
    ));

    // Calculate cumulative GPA
    const cumulativeResult = calculateCumulativeGPA(studentGrades, gradingScales, studentId);
    setCumulativeGPA(cumulativeResult.gpa);

    // Determine academic standing
    const lastSemesterGPA = semesterGPAResults[semesterGPAResults.length - 1]?.gpa || 0;
    const standing = determineAcademicStanding(cumulativeResult.gpa, lastSemesterGPA);
    setAcademicStanding(standing);
  };

  const getTrendIcon = (index: number) => {
    if (index === 0) return <Minus size={16} className="text-gray-400" />;
    const current = semesterGPAs[index].gpa;
    const previous = semesterGPAs[index - 1].gpa;
    const diff = current - previous;
    
    if (diff > 0.1) return <TrendingUp size={16} className="text-green-600" />;
    if (diff < -0.1) return <TrendingDown size={16} className="text-red-600" />;
    return <Minus size={16} className="text-gray-400" />;
  };

  const getStandingColor = (standing: AcademicStanding) => {
    switch (standing) {
      case AcademicStanding.HONOR_ROLL:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case AcademicStanding.GOOD_STANDING:
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case AcademicStanding.WARNING:
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case AcademicStanding.ACADEMIC_PROBATION:
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-6xl max-h-[90vh] overflow-hidden border-4 border-[#4B0082] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest">Student Grade Report</h2>
            <p className="text-xs text-gray-400 mt-1">{studentName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-12 h-12 border-4 border-[#4B0082]/30 border-t-[#4B0082] rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Cumulative GPA */}
                <div className="bg-gradient-to-br from-[#4B0082] to-[#7B1FA2] text-white p-6 rounded-lg">
                  <p className="text-xs uppercase tracking-widest opacity-80 mb-2">Cumulative GPA</p>
                  <p className="text-5xl font-black mb-2">{cumulativeGPA.toFixed(2)}</p>
                  <p className="text-xs opacity-80">Out of 4.0</p>
                </div>

                {/* Academic Standing */}
                <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 p-6 rounded-lg">
                  <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                    Academic Standing
                  </p>
                  <div className="flex items-center gap-2 mb-2">
                    {academicStanding === AcademicStanding.HONOR_ROLL && (
                      <Award size={24} className="text-yellow-600" />
                    )}
                    {academicStanding === AcademicStanding.ACADEMIC_PROBATION && (
                      <AlertCircle size={24} className="text-red-600" />
                    )}
                    <span className={`px-3 py-1 text-sm font-black uppercase tracking-widest rounded ${getStandingColor(academicStanding)}`}>
                      {academicStanding}
                    </span>
                  </div>
                </div>

                {/* Total Credits */}
                <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 p-6 rounded-lg">
                  <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                    Total Credits
                  </p>
                  <p className="text-5xl font-black text-gray-900 dark:text-white mb-2">
                    {grades.reduce((sum, g) => sum + g.credits, 0)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {grades.length} courses completed
                  </p>
                </div>
              </div>

              {/* GPA Trend Chart */}
              {semesterGPAs.length > 0 && (
                <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 p-6 rounded-lg">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white mb-4">
                    GPA Trend
                  </h3>
                  <div className="space-y-3">
                    {semesterGPAs.map((semesterGPA, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="w-32 text-xs font-bold text-gray-600 dark:text-gray-400">
                          {semesterGPA.semester} {semesterGPA.academicYear}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full transition-all ${
                                  semesterGPA.gpa >= 3.5 ? 'bg-green-600' :
                                  semesterGPA.gpa >= 3.0 ? 'bg-blue-600' :
                                  semesterGPA.gpa >= 2.0 ? 'bg-amber-600' :
                                  'bg-red-600'
                                }`}
                                style={{ width: `${(semesterGPA.gpa / 4.0) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-black text-gray-900 dark:text-white w-12 text-right">
                              {semesterGPA.gpa.toFixed(2)}
                            </span>
                            {getTrendIcon(index)}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {semesterGPA.totalCredits} credits
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Course Grades Table */}
              <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">
                    Course Grades
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                          Course
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                          Semester
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                          Credits
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                          Grade
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                          GPA
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {grades.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            No grades recorded yet
                          </td>
                        </tr>
                      ) : (
                        grades.map((grade) => (
                          <tr key={grade.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                  {grade.courseCode}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {grade.courseName}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-600 dark:text-gray-400">
                              {grade.semester} {grade.academicYear}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
                              {grade.credits}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xl font-black ${
                                grade.letterGrade.startsWith('A') ? 'text-green-600' :
                                grade.letterGrade.startsWith('B') ? 'text-blue-600' :
                                grade.letterGrade.startsWith('C') ? 'text-amber-600' :
                                'text-red-600'
                              }`}>
                                {grade.letterGrade}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-lg font-black text-gray-900 dark:text-white">
                              {grade.gradePoints.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {grade.isRetake && (
                                <span className="px-2 py-1 text-xs font-black uppercase tracking-widest rounded bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                                  Retake
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Generated on {new Date().toLocaleDateString()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-6 py-2 bg-[#4B0082] text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all"
            >
              Print Report
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-900 text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentGradeReport;









