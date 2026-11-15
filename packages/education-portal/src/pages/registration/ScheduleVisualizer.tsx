import { useMemo, useEffect, useRef } from 'react';

export interface ScheduleTimeSlot {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
  startTime: string; // '09:00'
  endTime: string;   // '10:30'
  room?: string;
}

export interface CourseWithSchedule {
  id: string;
  code: string;
  title: string;
  credits: number;
  schedule?: ScheduleTimeSlot[];
}

export interface ScheduleConflict {
  courseA: { id: string; code: string; title: string };
  courseB: { id: string; code: string; title: string };
  day: string;
  timeSlot: string;
}

interface ScheduleVisualizerProps {
  courses: CourseWithSchedule[];
  selectedCourseIds: string[];
  onConflictDetected?: (hasConflict: boolean, conflicts: ScheduleConflict[]) => void;
}

const DAYS: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'> = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

// Standard timetable generator for courses lacking hardcoded schedules
function getFallbackSchedule(code: string, index: number): ScheduleTimeSlot[] {
  const patterns: ScheduleTimeSlot[][] = [
    [
      { day: 'Mon', startTime: '09:00', endTime: '10:30', room: 'Hall A' },
      { day: 'Wed', startTime: '09:00', endTime: '10:30', room: 'Hall A' },
    ],
    [
      { day: 'Tue', startTime: '10:30', endTime: '12:00', room: 'Sem 2' },
      { day: 'Thu', startTime: '10:30', endTime: '12:00', room: 'Sem 2' },
    ],
    [
      { day: 'Mon', startTime: '13:00', endTime: '14:30', room: 'Lab 1' },
      { day: 'Wed', startTime: '13:00', endTime: '14:30', room: 'Lab 1' },
    ],
    [
      { day: 'Tue', startTime: '14:00', endTime: '15:30', room: 'Hall B' },
      { day: 'Thu', startTime: '14:00', endTime: '15:30', room: 'Hall B' },
    ],
    [
      { day: 'Fri', startTime: '09:00', endTime: '12:00', room: 'Main Aud' },
    ],
    [
      { day: 'Mon', startTime: '10:30', endTime: '12:00', room: 'Hall C' },
      { day: 'Wed', startTime: '10:30', endTime: '12:00', room: 'Hall C' },
    ],
  ];

  // Derive stable pattern from hash of course code or index
  const hash = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), index);
  return patterns[hash % patterns.length];
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export default function ScheduleVisualizer({
  courses,
  selectedCourseIds,
  onConflictDetected,
}: ScheduleVisualizerProps) {
  // 1. Resolve full schedules for all selected courses
  const scheduledCourses = useMemo(() => {
    return courses
      .filter(c => selectedCourseIds.includes(c.id))
      .map((c, idx) => ({
        ...c,
        slots: c.schedule && c.schedule.length > 0 ? c.schedule : getFallbackSchedule(c.code, idx),
      }));
  }, [courses, selectedCourseIds]);

  // 2. Compute overlaps and conflicts
  const conflicts = useMemo(() => {
    const foundConflicts: ScheduleConflict[] = [];

    for (let i = 0; i < scheduledCourses.length; i++) {
      for (let j = i + 1; j < scheduledCourses.length; j++) {
        const a = scheduledCourses[i];
        const b = scheduledCourses[j];

        for (const slotA of a.slots) {
          for (const slotB of b.slots) {
            if (slotA.day === slotB.day) {
              const startA = timeToMinutes(slotA.startTime);
              const endA = timeToMinutes(slotA.endTime);
              const startB = timeToMinutes(slotB.startTime);
              const endB = timeToMinutes(slotB.endTime);

              // Overlap formula: startA < endB && endA > startB
              if (startA < endB && endA > startB) {
                foundConflicts.push({
                  courseA: { id: a.id, code: a.code, title: a.title },
                  courseB: { id: b.id, code: b.code, title: b.title },
                  day: slotA.day,
                  timeSlot: `${slotA.day} (${slotA.startTime}-${slotA.endTime} vs ${slotB.startTime}-${slotB.endTime})`,
                });
              }
            }
          }
        }
      }
    }

    return foundConflicts;
  }, [scheduledCourses]);

  const onConflictDetectedRef = useRef(onConflictDetected);
  useEffect(() => {
    onConflictDetectedRef.current = onConflictDetected;
  });

  useEffect(() => {
    onConflictDetectedRef.current?.(conflicts.length > 0, conflicts);
  }, [conflicts]);

  // Total Contact Hours calculation
  const totalWeeklyHours = useMemo(() => {
    let totalMinutes = 0;
    for (const c of scheduledCourses) {
      for (const s of c.slots) {
        totalMinutes += timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
      }
    }
    return (totalMinutes / 60).toFixed(1);
  }, [scheduledCourses]);

  const conflictingCourseIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of conflicts) {
      ids.add(c.courseA.id);
      ids.add(c.courseB.id);
    }
    return ids;
  }, [conflicts]);

  return (
    <div style={{ marginTop: '1.5rem', background: '#ffffff', borderRadius: 10, border: '1px solid var(--border)', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h4 style={{ margin: 0, color: 'var(--navy)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📅</span> Live Timetable & Schedule Grid
          </h4>
          <span style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>
            Weekly Contact Time: <strong>{totalWeeklyHours} hrs/week</strong> • {scheduledCourses.length} Courses Active
          </span>
        </div>

        {conflicts.length > 0 ? (
          <span style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '0.3rem 0.8rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 700 }}>
            ⚠️ {conflicts.length} Time Conflict Detected
          </span>
        ) : (
          <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '0.3rem 0.8rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 700 }}>
            ✓ No Timetable Conflicts
          </span>
        )}
      </div>

      {conflicts.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #f87171', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#991b1b', fontSize: '0.85rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Schedule Conflict Alert:</strong>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {conflicts.map((c, i) => (
              <li key={i}>
                <strong>{c.courseA.code}</strong> and <strong>{c.courseB.code}</strong> overlap on <strong>{c.timeSlot}</strong>.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timetable Grid */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 620, display: 'grid', gridTemplateColumns: '70px repeat(5, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {/* Day Headers */}
          <div style={{ background: '#f8fafc', padding: '0.5rem', fontWeight: 700, fontSize: '0.75rem', color: 'var(--slate)', textAlign: 'center' }}>
            Time
          </div>
          {DAYS.map(day => (
            <div key={day} style={{ background: '#f8fafc', padding: '0.5rem', fontWeight: 700, fontSize: '0.8rem', color: 'var(--navy)', textAlign: 'center' }}>
              {day}
            </div>
          ))}

          {/* Hour Rows */}
          {HOURS.map(hour => {
            const timeLabel = `${hour.toString().padStart(2, '0')}:00`;
            return (
              <div key={hour} style={{ display: 'contents' }}>
                <div style={{ background: 'white', padding: '0.6rem 0.3rem', fontSize: '0.75rem', color: 'var(--slate)', textAlign: 'center', borderTop: '1px solid #f1f5f9' }}>
                  {timeLabel}
                </div>

                {DAYS.map(day => {
                  // Find all slots meeting during this hour on this day
                  const hourStart = hour * 60;
                  const hourEnd = (hour + 1) * 60;

                  const matchingSlots: Array<{ course: typeof scheduledCourses[0]; slot: ScheduleTimeSlot }> = [];
                  for (const c of scheduledCourses) {
                    for (const s of c.slots) {
                      if (s.day === day) {
                        const sStart = timeToMinutes(s.startTime);
                        const sEnd = timeToMinutes(s.endTime);
                        if (sStart < hourEnd && sEnd > hourStart) {
                          matchingSlots.push({ course: c, slot: s });
                        }
                      }
                    }
                  }

                  const hasSlotConflict = matchingSlots.length > 1;

                  return (
                    <div
                      key={day}
                      style={{
                        background: hasSlotConflict ? '#fff1f2' : matchingSlots.length > 0 ? '#f0fdf4' : 'white',
                        padding: '0.35rem',
                        minHeight: 48,
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {matchingSlots.map(({ course, slot }) => {
                        const isConflicted = conflictingCourseIds.has(course.id);
                        return (
                          <div
                            key={course.id}
                            style={{
                              background: isConflicted ? '#ef4444' : '#1e3a8a',
                              color: 'white',
                              borderRadius: 4,
                              padding: '0.25rem 0.4rem',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              lineHeight: 1.2,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>{course.code}</span>
                              <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>{slot.room}</span>
                            </div>
                            <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>
                              {slot.startTime}-{slot.endTime}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
