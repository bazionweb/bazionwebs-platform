/**
 * BMI UMS - ECTS Converter
 * Converts between US credit hours and ECTS credits
 */

import { ECTSConversionConfig } from '../types';
import { DEFAULT_ECTS_CONVERSION } from '../utils/constants';

/**
 * Convert US credit hours to ECTS credits
 * Default formula: ECTS = US_Credits × 2
 */
export function convertUSToECTS(
  usCredits: number,
  config: ECTSConversionConfig = {
    usCreditsToECTSRatio: DEFAULT_ECTS_CONVERSION.US_TO_ECTS_RATIO,
    ectsToUSCreditsRatio: DEFAULT_ECTS_CONVERSION.ECTS_TO_US_RATIO,
    displayBothOnTranscript: true,
  }
): number {
  return Math.round(usCredits * config.usCreditsToECTSRatio * 100) / 100;
}

/**
 * Convert ECTS credits to US credit hours
 * Default formula: US_Credits = ECTS ÷ 2
 */
export function convertECTSToUS(
  ectsCredits: number,
  config: ECTSConversionConfig = {
    usCreditsToECTSRatio: DEFAULT_ECTS_CONVERSION.US_TO_ECTS_RATIO,
    ectsToUSCreditsRatio: DEFAULT_ECTS_CONVERSION.ECTS_TO_US_RATIO,
    displayBothOnTranscript: true,
  }
): number {
  return Math.round(ectsCredits * config.ectsToUSCreditsRatio * 100) / 100;
}

/**
 * Format credits for display (both US and ECTS if configured)
 */
export function formatCredits(
  usCredits: number,
  config: ECTSConversionConfig
): string {
  if (config.displayBothOnTranscript) {
    const ects = convertUSToECTS(usCredits, config);
    return `${usCredits} US credits (${ects} ECTS)`;
  }
  return `${usCredits} credits`;
}









