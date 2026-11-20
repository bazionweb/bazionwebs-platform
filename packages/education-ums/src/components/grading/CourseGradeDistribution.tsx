/**
 * BMI UMS - Course Grade Distribution Component
 * Displays grade distribution analytics with charts and statistics
 */

import React, { useState, useEffect } from "react";
import { PlatformBrandBadge } from '../PlatformBrandBadge';
import { useUIStore } from '../../stores/uiStore';
import { X, BarChart3, TrendingUp, Users } from '../../shims/lucide-react';
import { Grade, GradeDistribution } from "../../grading/types";
import { getCourseGrades } from "../../grading/services/GradeAPIService";
import { calculateGradeDistribution } from "../../grading/engines/GradeAnalyticsEngine";

interface CourseGradeDistributionProps {
  courseCode: string;
  courseName: string;
  academicYear: string;
  semester: string;
  isOpen: boolean;
  onClose: () => void;
}

const CourseGradeDistribution: React.FC<CourseGradeDistributionProps> = ({
  courseCode,
  courseName,
  academicYear,
  semester,
  isOpen,
  onClose,
}) => {
  const institutionName = useUIStore((state) => state.institutionName);
  const institutionLogo = useUIStore((state) => state.logo);
  const [distribution, setDistribution] = useState<GradeDistribution | null>(
    null,
  );
  const [, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && courseCode) {
      loadCourseGrades();
    }
  }, [isOpen, courseCode, academicYear, semester]);

  const loadCourseGrades = async () => {
    setIsLoading(true);
    try {
      const response = await getCourseGrades(courseCode);
      if (response.success && response.data) {
        const courseGrades = response.data.items.filter(
          (g) => g.academicYear === academicYear && g.semester === semester,
        );
        setGrades(courseGrades);

        const dist = calculateGradeDistribution(
          courseGrades,
          courseCode,
          courseName,
          academicYear,
          semester,
        );
        setDistribution(dist);
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error("Failed to load course grades:", error);
     } finally {
      setIsLoading(false);
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "bg-green-600";
    if (grade.startsWith("B")) return "bg-blue-600";
    if (grade.startsWith("C")) return "bg-amber-600";
    if (grade.startsWith("D")) return "bg-orange-600";
    return "bg-red-600";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-5xl max-h-[90vh] overflow-hidden border-4 border-[#4B0082] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {institutionLogo && <img src={institutionLogo} alt={`${institutionName} logo`} className="w-10 h-10 object-contain bg-white rounded p-1" />}
            <div>
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">{institutionName}</p>
              <h2 className="text-xl font-black uppercase tracking-widest">Grade Distribution</h2>
              <p className="text-xs text-gray-400 mt-1">{courseCode} - {courseName} ({semester} {academicYear})</p>
            </div>
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
          ) : distribution ? (
            <div className="space-y-6">
              {/* Statistics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-[#4B0082] to-[#7B1FA2] text-white p-4 rounded-lg text-center">
                  <Users size={24} className="mx-auto mb-2 opacity-80" />
                  <p className="text-2xl font-black">
                    {distribution.statistics.totalStudents}
                  </p>
                  <p className="text-xs uppercase tracking-widest opacity-80">
                    Students
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 p-4 rounded-lg text-center">
                  <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                    Mean
                  </p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {distribution.statistics.mean.toFixed(1)}%
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 p-4 rounded-lg text-center">
                  <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                    Median
                  </p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {distribution.statistics.median.toFixed(1)}%
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 p-4 rounded-lg text-center">
                  <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                    Std Dev
                  </p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">
                    {distribution.statistics.standardDeviation.toFixed(1)}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 p-4 rounded-lg text-center">
                  <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                    Range
                  </p>
                  <p className="text-sm font-black text-gray-900 dark:text-white">
                    {distribution.statistics.min.toFixed(0)} -{" "}
                    {distribution.statistics.max.toFixed(0)}
                  </p>
                </div>
              </div>

              {/* Grade Distribution Chart */}
              <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 p-6 rounded-lg">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <BarChart3 size={20} />
                  Grade Distribution
                </h3>

                <div className="space-y-4">
                  {Object.entries(distribution.distribution)
                    .sort((a, b) => {
                      const gradeOrder = [
                        "A+",
                        "A",
                        "A-",
                        "B+",
                        "B",
                        "B-",
                        "C+",
                        "C",
                        "C-",
                        "D+",
                        "D",
                        "F",
                      ];
                      return (
                        gradeOrder.indexOf(a[0]) - gradeOrder.indexOf(b[0])
                      );
                    })
                    .map(([grade, count]) => {
                      const percentage = distribution.percentages[grade] || 0;
                      return (
                        <div key={grade} className="flex items-center gap-4">
                          <div className="w-12 text-center">
                            <span className="text-lg font-black text-gray-900 dark:text-white">
                              {grade}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-8 relative overflow-hidden">
                                <div
                                  className={`${getGradeColor(grade)} h-8 rounded-full transition-all flex items-center justify-end pr-3`}
                                  style={{ width: `${percentage}%` }}
                                >
                                  {percentage > 10 && (
                                    <span className="text-xs font-bold text-white">
                                      {count} ({percentage.toFixed(1)}%)
                                    </span>
                                  )}
                                </div>
                              </div>
                              {percentage <= 10 && (
                                <span className="text-xs font-bold text-gray-600 dark:text-gray-400 w-24">
                                  {count} ({percentage.toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Grade Category Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Passing vs Failing */}
                <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 p-6 rounded-lg">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white mb-4">
                    Pass/Fail Rate
                  </h3>
                  <div className="space-y-3">
                    {(() => {
                      const passingGrades = [
                        "A+",
                        "A",
                        "A-",
                        "B+",
                        "B",
                        "B-",
                        "C+",
                        "C",
                        "C-",
                        "D+",
                        "D",
                      ];
                      const passingCount = Object.entries(
                        distribution.distribution,
                      )
                        .filter(([grade]) => passingGrades.includes(grade))
                        .reduce((sum, [, count]) => sum + (count as number), 0);
                      const failingCount = distribution.distribution["F"] || 0;
                      const total = passingCount + failingCount;
                      const passRate =
                        total > 0 ? (passingCount / total) * 100 : 0;

                      return (
                        <>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-bold text-green-600">
                                Passing
                              </span>
                              <span className="font-black text-gray-900 dark:text-white">
                                {passingCount} ({passRate.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                              <div
                                className="bg-green-600 h-3 rounded-full transition-all"
                                style={{ width: `${passRate}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-bold text-red-600">
                                Failing
                              </span>
                              <span className="font-black text-gray-900 dark:text-white">
                                {failingCount} ({(100 - passRate).toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                              <div
                                className="bg-red-600 h-3 rounded-full transition-all"
                                style={{ width: `${100 - passRate}%` }}
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Grade Categories */}
                <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 p-6 rounded-lg">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white mb-4">
                    Grade Categories
                  </h3>
                  <div className="space-y-2">
                    {[
                      {
                        label: "A Range",
                        grades: ["A+", "A", "A-"],
                        color: "text-green-600",
                      },
                      {
                        label: "B Range",
                        grades: ["B+", "B", "B-"],
                        color: "text-blue-600",
                      },
                      {
                        label: "C Range",
                        grades: ["C+", "C", "C-"],
                        color: "text-amber-600",
                      },
                      {
                        label: "D Range",
                        grades: ["D+", "D"],
                        color: "text-orange-600",
                      },
                      { label: "F", grades: ["F"], color: "text-red-600" },
                    ].map(({ label, grades, color }) => {
                      const count = grades.reduce(
                        (sum, g) => sum + (distribution.distribution[g] || 0),
                        0,
                      );
                      const percentage = grades.reduce(
                        (sum, g) => sum + (distribution.percentages[g] || 0),
                        0,
                      );
                      return (
                        <div
                          key={label}
                          className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                        >
                          <span className={`text-sm font-bold ${color}`}>
                            {label}
                          </span>
                          <span className="text-sm font-black text-gray-900 dark:text-white">
                            {count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Performance Insights */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 p-6 rounded-lg">
                <h3 className="text-sm font-black uppercase tracking-widest text-blue-900 dark:text-blue-400 mb-3 flex items-center gap-2">
                  <TrendingUp size={20} />
                  Performance Insights
                </h3>
                <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                  {distribution.statistics.mean >= 80 && (
                    <p>
                      ✓ Class average is strong at{" "}
                      {distribution.statistics.mean.toFixed(1)}%
                    </p>
                  )}
                  {distribution.statistics.mean < 70 && (
                    <p>
                      ⚠ Class average is below 70% - consider reviewing course
                      difficulty
                    </p>
                  )}
                  {distribution.statistics.standardDeviation > 15 && (
                    <p>
                      ⚠ High standard deviation (
                      {distribution.statistics.standardDeviation.toFixed(1)})
                      indicates varied performance
                    </p>
                  )}
                  {distribution.statistics.standardDeviation < 10 && (
                    <p>
                      ✓ Low standard deviation indicates consistent performance
                      across students
                    </p>
                  )}
                  {(() => {
                    const failRate = distribution.percentages["F"] || 0;
                    if (failRate > 20) {
                      return (
                        <p>
                          ⚠ High failure rate ({failRate.toFixed(1)}%) -
                          intervention may be needed
                        </p>
                      );
                    }
                    if (failRate === 0) {
                      return (
                        <p>✓ No failing grades - excellent class performance</p>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500 dark:text-gray-400">
                No grade data available
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center gap-2">
          <PlatformBrandBadge compact />
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
  );
};

export default CourseGradeDistribution;









