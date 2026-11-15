/**
 * @bmi/shared — Programs Catalog
 *
 * Canonical program list for BMI University.
 * Both the marketing site (bmi-university) and the admissions portal (bmi-portal)
 * import from here as fallback/types, while the database is the primary source of truth.
 */

export interface Program {
  label: string;
  level: 'undergraduate' | 'graduate' | 'doctorate' | 'certificate' | 'diploma';
  description: string;
  icon?: string;
}

const LEVEL_ICONS = {
  undergraduate: '/images/bachelor-icon.png',
  graduate: '/images/masters-icon.png',
  doctorate: '/images/phd-icon.png',
  certificate: undefined,
  diploma: '/images/diploma-icon.png',
} as const;

export const PROGRAMS: Program[] = [
  // ── Undergraduate ─────────────────────────────────────────────────────────
  {
    label: 'BA in Biblical Studies',
    level: 'undergraduate',
    description: 'Gain a deep understanding of Scripture and theological foundations to serve God in ministry, education, and everyday life.',
    icon: LEVEL_ICONS.undergraduate,
  },
  {
    label: 'BA in Christian Education',
    level: 'undergraduate',
    description: 'Become equipped with biblical knowledge and teaching skills to lead and educate in Christian schools, churches, and ministry settings.',
    icon: LEVEL_ICONS.undergraduate,
  },
  {
    label: 'BA in Ministry Leadership',
    level: 'undergraduate',
    description: 'Gain biblical knowledge and leadership skills to effectively lead in church, ministry, and community settings.',
    icon: LEVEL_ICONS.undergraduate,
  },
  {
    label: 'BA in Theological Studies',
    level: 'undergraduate',
    description: 'Deepen your understanding of biblical theology and prepare for impactful roles in ministry, teaching, and further theological education.',
    icon: LEVEL_ICONS.undergraduate,
  },
  {
    label: 'BA in Worship Leadership',
    level: 'undergraduate',
    description: 'Be equipped with biblical knowledge and practical skills to lead worship teams and cultivate meaningful worship experiences in church and ministry settings.',
    icon: LEVEL_ICONS.undergraduate,
  },

  // ── Graduate ───────────────────────────────────────────────────────────────
  {
    label: 'Master of Divinity (MDiv)',
    level: 'graduate',
    description: 'Gain advanced theological education, practical ministry skills, and biblical knowledge to lead and serve effectively in ministry and beyond.',
    icon: LEVEL_ICONS.graduate,
  },
  {
    label: 'MA in Christian Counseling',
    level: 'graduate',
    description: 'Be equipped with biblical principles and practical skills to provide compassionate, faith-based guidance and support in ministry and professional counseling settings.',
    icon: LEVEL_ICONS.graduate,
  },
  {
    label: 'MA in Theological Studies',
    level: 'graduate',
    description: 'Deepen your biblical knowledge and theological understanding to excel in ministry, academic, and leadership roles within the church and beyond.',
    icon: LEVEL_ICONS.graduate,
  },
  {
    label: 'MA in Christian Education',
    level: 'graduate',
    description: 'Prepare with biblical foundations and educational expertise to lead and inspire in Christian schools, churches, and ministry settings.',
    icon: LEVEL_ICONS.graduate,
  },
  {
    label: 'MA in Christian Apologetics',
    level: 'graduate',
    description: 'Become equipped with biblical knowledge and critical reasoning to effectively defend and communicate the Christian faith in diverse settings.',
    icon: LEVEL_ICONS.graduate,
  },
  {
    label: 'MA in Christian Leadership',
    level: 'graduate',
    description: 'Be empowered with biblical principles and leadership skills to lead effectively in ministry, church, and organizational settings.',
    icon: LEVEL_ICONS.graduate,
  },

  // ── Doctorate ─────────────────────────────────────────────────────────────
  {
    label: 'Doctor of Ministry (DMin)',
    level: 'doctorate',
    description: 'Advance your ministry skills and theological expertise to lead with greater impact and effectiveness in church and community leadership.',
    icon: LEVEL_ICONS.doctorate,
  },
  {
    label: 'Doctor of Christian Education',
    level: 'doctorate',
    description: 'Equip yourself with advanced educational theory and research skills to lead and transform Christian educational institutions.',
    icon: LEVEL_ICONS.doctorate,
  },

  // ── Graduate Certificates ─────────────────────────────────────────────────
  {
    label: 'Graduate Certificate in Christian Studies',
    level: 'certificate',
    description: 'Develop a deeper understanding of Christian worldview and theology to enrich your personal faith and ministry involvement.',
  },
  {
    label: 'Graduate Certificate in Spiritual Formation',
    level: 'certificate',
    description: 'Focus on the spiritual disciplines and character formation required for deep spiritual growth and ministry longevity.',
  },

  // ── Diploma ───────────────────────────────────────────────────────────────
  {
    label: 'Diploma in Christian Ministry and Theology',
    level: 'diploma',
    description: 'A foundational one-year programme equipping students with core biblical and theological understanding, spiritual formation, and practical ministry competencies.',
    icon: LEVEL_ICONS.diploma,
  },
];

/** Flat list of program labels — used for validation. */
export const VALID_PROGRAMS: string[] = PROGRAMS.map((p) => p.label);

/** Valid degree level values. */
export const VALID_LEVELS = ['undergraduate', 'graduate', 'doctorate', 'certificate', 'diploma'] as const;
export type ProgramLevel = (typeof VALID_LEVELS)[number];
