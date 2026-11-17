/**
 * BMI UMS - ECTSConverter Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { convertUSToECTS, convertECTSToUS, formatCredits } from './ECTSConverter';
import type { ECTSConversionConfig } from '../types';

// ---------------------------------------------------------------------------
// Default conversion config used throughout these tests
// ---------------------------------------------------------------------------
const defaultConfig: ECTSConversionConfig = {
  usCreditsToECTSRatio: 2,
  ectsToUSCreditsRatio: 0.5,
  displayBothOnTranscript: true,
};

// ---------------------------------------------------------------------------
// convertUSToECTS
// ---------------------------------------------------------------------------
describe('convertUSToECTS', () => {
  it('converts 3 US credits to 6 ECTS with default ratio (×2)', () => {
    expect(convertUSToECTS(3, defaultConfig)).toBe(6);
  });

  it('converts 1.5 US credits to 3 ECTS', () => {
    expect(convertUSToECTS(1.5, defaultConfig)).toBe(3);
  });

  it('converts 0 US credits to 0 ECTS', () => {
    expect(convertUSToECTS(0, defaultConfig)).toBe(0);
  });

  it('uses a custom ratio: 4 US credits × 1.5 = 6 ECTS', () => {
    const customConfig: ECTSConversionConfig = {
      usCreditsToECTSRatio: 1.5,
      ectsToUSCreditsRatio: 0.5,
      displayBothOnTranscript: true,
    };
    expect(convertUSToECTS(4, customConfig)).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// convertECTSToUS
// ---------------------------------------------------------------------------
describe('convertECTSToUS', () => {
  it('converts 6 ECTS to 3 US credits with default ratio (×0.5)', () => {
    expect(convertECTSToUS(6, defaultConfig)).toBe(3);
  });

  it('converts 0 ECTS to 0 US credits', () => {
    expect(convertECTSToUS(0, defaultConfig)).toBe(0);
  });

  it('uses a custom ratio: 4 ECTS × 0.75 = 3 US credits', () => {
    const customConfig: ECTSConversionConfig = {
      usCreditsToECTSRatio: 2,
      ectsToUSCreditsRatio: 0.75,
      displayBothOnTranscript: true,
    };
    expect(convertECTSToUS(4, customConfig)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// formatCredits
// ---------------------------------------------------------------------------
describe('formatCredits', () => {
  it('includes both the US credit count and the ECTS count when displayBothOnTranscript is true', () => {
    const result = formatCredits(3, defaultConfig);
    // Default: "3 US credits (6 ECTS)"
    expect(result).toContain('3');
    expect(result).toContain('6');
    expect(result).toContain('ECTS');
  });

  it('contains the credit count but NOT the string "ECTS" when displayBothOnTranscript is false', () => {
    const config: ECTSConversionConfig = {
      ...defaultConfig,
      displayBothOnTranscript: false,
    };
    const result = formatCredits(3, config);
    expect(result).toContain('3');
    expect(result).not.toContain('ECTS');
  });
});









