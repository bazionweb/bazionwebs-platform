/**
 * @bmi/shared — Brand Design Tokens
 *
 * Canonical color values for BMI University branding.
 * Oxford Navy & Burnished Gold Institutional Theme.
 */

export const BrandColors = {
  /** Deep Oxford Navy — #091223 */
  oxfordNavy: '#091223',
  /** Primary Imperial Navy — #0e1d38 */
  navy: '#0e1d38',
  /** Mid-tone navy for cards / hero gradients — #172a4d */
  navyMid: '#172a4d',
  /** Light navy for borders & labels — #233c66 */
  navyLight: '#233c66',

  /** Primary Burnished Gold accent — #c5a048 */
  gold: '#c5a048',
  /** Radiant gold for highlights & hover — #e5c578 */
  goldLight: '#e5c578',
  /** Deep gold for borders and contrast — #a07e2c */
  goldDark: '#a07e2c',
  /** Subtle parchment gold tint — #f7f3e8 */
  goldParchment: '#f7f3e8',

  /** Dark charcoal body text — #1e293b */
  charcoal: '#1e293b',
  /** Muted slate text — #64748b */
  slate: '#64748b',
  /** Light slate for borders & placeholders — #94a3b8 */
  slateLight: '#94a3b8',

  /** Page background — #f8fafc */
  bg: '#f8fafc',
  /** Pure white canvas — #ffffff */
  white: '#ffffff',
} as const;

export type BrandColorKey = keyof typeof BrandColors;
