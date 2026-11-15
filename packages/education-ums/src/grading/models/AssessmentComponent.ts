/**
 * BMI UMS - AssessmentComponent Domain Model
 * Implements assessment component configuration and validation
 */

import {
  AssessmentComponent,
  AssessmentType,
  ComponentScore,
} from '../types';

/**
 * Create an assessment component
 */
export function createAssessmentComponent(
  type: AssessmentType,
  name: string,
  weight: number,
  maxScore: number,
  description?: string
): AssessmentComponent {
  validateWeight(weight);
  validateMaxScore(maxScore);

  return {
    id: generateComponentId(type, name),
    type,
    name,
    weight,
    maxScore,
    description,
  };
}

/**
 * Generate a unique component ID
 */
function generateComponentId(type: AssessmentType, name: string): string {
  const timestamp = Date.now();
  const sanitizedName = name.toLowerCase().replace(/\s+/g, '-');
  return `${type.toLowerCase()}-${sanitizedName}-${timestamp}`;
}

/**
 * Validate component weight
 */
function validateWeight(weight: number): void {
  if (weight < 0 || weight > 100) {
    throw new Error(`Invalid weight: ${weight}. Weight must be between 0 and 100.`);
  }
}

/**
 * Validate max score
 */
function validateMaxScore(maxScore: number): void {
  if (maxScore <= 0) {
    throw new Error(`Invalid max score: ${maxScore}. Max score must be greater than 0.`);
  }
}

/**
 * Validate that component weights sum to 100%
 */
export function validateComponentWeights(components: AssessmentComponent[]): {
  isValid: boolean;
  totalWeight: number;
  error?: string;
} {
  if (components.length === 0) {
    return {
      isValid: false,
      totalWeight: 0,
      error: 'No assessment components defined',
    };
  }

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  
  // Allow small floating point errors (within 0.01%)
  const isValid = Math.abs(totalWeight - 100) < 0.01;

  return {
    isValid,
    totalWeight,
    error: isValid ? undefined : `Total weight is ${totalWeight}%, must equal 100%`,
  };
}

/**
 * Create a component score
 */
export function createComponentScore(
  component: AssessmentComponent,
  score: number,
  feedback?: string
): ComponentScore {
  validateScore(score, component.maxScore);

  return {
    componentId: component.id,
    componentType: component.type,
    score,
    maxScore: component.maxScore,
    weight: component.weight,
    gradedAt: new Date().toISOString(),
    feedback,
  };
}

/**
 * Validate a component score
 */
function validateScore(score: number, maxScore: number): void {
  if (score < 0) {
    throw new Error(`Invalid score: ${score}. Score cannot be negative.`);
  }
  
  if (score > maxScore) {
    throw new Error(
      `Invalid score: ${score}. Score cannot exceed max score of ${maxScore}.`
    );
  }
}

/**
 * Update a component score
 */
export function updateComponentScore(
  componentScore: ComponentScore,
  newScore: number,
  feedback?: string
): ComponentScore {
  validateScore(newScore, componentScore.maxScore);

  return {
    ...componentScore,
    score: newScore,
    feedback: feedback ?? componentScore.feedback,
    gradedAt: new Date().toISOString(),
  };
}

/**
 * Check if all components have been graded
 */
export function areAllComponentsGraded(
  components: AssessmentComponent[],
  componentScores: ComponentScore[]
): boolean {
  if (components.length === 0) {
    return false;
  }

  const gradedComponentIds = new Set(componentScores.map(cs => cs.componentId));
  return components.every(component => gradedComponentIds.has(component.id));
}

/**
 * Get missing components (not yet graded)
 */
export function getMissingComponents(
  components: AssessmentComponent[],
  componentScores: ComponentScore[]
): AssessmentComponent[] {
  const gradedComponentIds = new Set(componentScores.map(cs => cs.componentId));
  return components.filter(component => !gradedComponentIds.has(component.id));
}

/**
 * Calculate completion percentage
 */
export function calculateCompletionPercentage(
  components: AssessmentComponent[],
  componentScores: ComponentScore[]
): number {
  if (components.length === 0) {
    return 0;
  }

  const gradedWeight = componentScores.reduce((sum, cs) => sum + cs.weight, 0);
  return (gradedWeight / 100) * 100; // Returns percentage
}

/**
 * Common assessment component templates
 */
export const ASSESSMENT_TEMPLATES = {
  /**
   * Traditional: Midterm 30%, Final 40%, Assignments 30%
   */
  TRADITIONAL: (): AssessmentComponent[] => [
    createAssessmentComponent(AssessmentType.MIDTERM, 'Midterm Exam', 30, 100),
    createAssessmentComponent(AssessmentType.FINAL_EXAM, 'Final Exam', 40, 100),
    createAssessmentComponent(AssessmentType.ASSIGNMENT, 'Assignments', 30, 100),
  ],

  /**
   * Balanced: Midterm 25%, Final 25%, Assignments 25%, Projects 25%
   */
  BALANCED: (): AssessmentComponent[] => [
    createAssessmentComponent(AssessmentType.MIDTERM, 'Midterm Exam', 25, 100),
    createAssessmentComponent(AssessmentType.FINAL_EXAM, 'Final Exam', 25, 100),
    createAssessmentComponent(AssessmentType.ASSIGNMENT, 'Assignments', 25, 100),
    createAssessmentComponent(AssessmentType.PROJECT, 'Projects', 25, 100),
  ],

  /**
   * Project-Heavy: Projects 50%, Assignments 30%, Final 20%
   */
  PROJECT_HEAVY: (): AssessmentComponent[] => [
    createAssessmentComponent(AssessmentType.PROJECT, 'Projects', 50, 100),
    createAssessmentComponent(AssessmentType.ASSIGNMENT, 'Assignments', 30, 100),
    createAssessmentComponent(AssessmentType.FINAL_EXAM, 'Final Exam', 20, 100),
  ],

  /**
   * Exam-Focused: Midterm 35%, Final 50%, Quizzes 15%
   */
  EXAM_FOCUSED: (): AssessmentComponent[] => [
    createAssessmentComponent(AssessmentType.MIDTERM, 'Midterm Exam', 35, 100),
    createAssessmentComponent(AssessmentType.FINAL_EXAM, 'Final Exam', 50, 100),
    createAssessmentComponent(AssessmentType.QUIZ, 'Quizzes', 15, 100),
  ],

  /**
   * Lab-Based: Labs 40%, Midterm 20%, Final 30%, Reports 10%
   */
  LAB_BASED: (): AssessmentComponent[] => [
    createAssessmentComponent(AssessmentType.LAB_WORK, 'Lab Work', 40, 100),
    createAssessmentComponent(AssessmentType.MIDTERM, 'Midterm Exam', 20, 100),
    createAssessmentComponent(AssessmentType.FINAL_EXAM, 'Final Exam', 30, 100),
    createAssessmentComponent(AssessmentType.ASSIGNMENT, 'Lab Reports', 10, 100),
  ],

  /**
   * Continuous Assessment: Assignments 40%, Quizzes 30%, Final 30%
   */
  CONTINUOUS: (): AssessmentComponent[] => [
    createAssessmentComponent(AssessmentType.ASSIGNMENT, 'Assignments', 40, 100),
    createAssessmentComponent(AssessmentType.QUIZ, 'Quizzes', 30, 100),
    createAssessmentComponent(AssessmentType.FINAL_EXAM, 'Final Exam', 30, 100),
  ],
};

/**
 * Get assessment template by name
 */
export function getAssessmentTemplate(
  templateName: keyof typeof ASSESSMENT_TEMPLATES
): AssessmentComponent[] {
  const template = ASSESSMENT_TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Unknown assessment template: ${templateName}`);
  }
  return template();
}

/**
 * Get all available template names
 */
export function getAvailableTemplates(): string[] {
  return Object.keys(ASSESSMENT_TEMPLATES);
}









