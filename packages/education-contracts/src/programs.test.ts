import { describe, it, expect } from 'vitest';
import { PROGRAMS, VALID_PROGRAMS, VALID_LEVELS } from '../src/programs.js';
import type { Program, ProgramLevel } from '../src/programs.js';

describe('@bmi/shared — programs', () => {
  it('exports exactly 16 active canonical programs', () => {
    expect(PROGRAMS).toHaveLength(16);
  });

  it('all programs have non-empty label', () => {
    for (const p of PROGRAMS) {
      expect(p.label.trim()).not.toBe('');
    }
  });

  it('all programs have a valid level', () => {
    const validLevels: Set<ProgramLevel> = new Set(VALID_LEVELS);
    for (const p of PROGRAMS) {
      expect(validLevels.has(p.level as ProgramLevel)).toBe(true);
    }
  });

  it('all programs have a non-empty description', () => {
    for (const p of PROGRAMS) {
      expect(p.description.trim()).not.toBe('');
    }
  });

  it('program labels are unique (no duplicates)', () => {
    const labels = PROGRAMS.map((p) => p.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });

  it('VALID_PROGRAMS is a flat string array matching all program labels', () => {
    expect(VALID_PROGRAMS).toHaveLength(PROGRAMS.length);
    for (const p of PROGRAMS) {
      expect(VALID_PROGRAMS).toContain(p.label);
    }
  });

  it('VALID_LEVELS contains the expected values including diploma', () => {
    expect(VALID_LEVELS).toContain('undergraduate');
    expect(VALID_LEVELS).toContain('graduate');
    expect(VALID_LEVELS).toContain('doctorate');
    expect(VALID_LEVELS).toContain('certificate');
    expect(VALID_LEVELS).toContain('diploma');
    expect(VALID_LEVELS).toHaveLength(5);
  });

  it('has programs in each level', () => {
    const byLevel = (level: ProgramLevel) =>
      PROGRAMS.filter((p) => p.level === level);

    expect(byLevel('undergraduate').length).toBeGreaterThan(0);
    expect(byLevel('graduate').length).toBeGreaterThan(0);
    expect(byLevel('doctorate').length).toBeGreaterThan(0);
    expect(byLevel('certificate').length).toBeGreaterThan(0);
    expect(byLevel('diploma').length).toBeGreaterThan(0);
  });

  it('snapshot — program catalog shape has not changed (drift guard)', () => {
    expect(PROGRAMS.map((p) => ({ label: p.label, level: p.level }))).toMatchSnapshot();
  });
});
