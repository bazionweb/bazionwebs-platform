/**
 * Re-exports the canonical program catalog from @bmi/shared.
 *
 * Previously this file contained a manually-maintained copy of the program list.
 * G-2 fix: the duplicate has been replaced by the single source of truth.
 *
 * All existing imports of PROGRAMS from '@/lib/programs' continue to work
 * without any changes in the calling components.
 */
export { PROGRAMS } from './contracts-bridge';
