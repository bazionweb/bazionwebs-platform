/**
 * BMI UMS - Weighted Grade Calculator
 * Calculates final grades from weighted assessment components
 */

import {
  AssessmentComponent,
  ComponentScore,
  GradeStatus,
} from '../types';
import {
  validateComponentWeights,
  areAllComponentsGraded,
  getMissingComponents,
  calculateCompletionPercentage,
} from '../models/AssessmentComponent';

/**
 * Result of weighted grade calculation
 */
export interface WeightedGradeResult {
  finalGrade: number; // 0-100
  status: GradeStatus;
  isComplete: boolean;
  completionPercentage: number;
  componentBreakdown: Array<{
    componentId: string;
    componentType: string;
    score: number;
    maxScore: number;
    weight: number;
    weightedScore: number;
  }>;
  missingComponents: string[];
}

/**
 * Calculate weighted final grade from component scores
 * Formula: Final_Grade = Σ(Component_Score × Component_Weight)
 */
export function calculateWeightedGrade(
  components: AssessmentComponent[],
  componentScores: ComponentScore[]
): WeightedGradeResult {
  // Loosened: Don't throw if weights don't sum to 100%
  const weightValidation = validateComponentWeights(components);
  const totalDefinedWeight = weightValidation.totalWeight;

  // Check if all components are graded
  const allGraded = areAllComponentsGraded(components, componentScores);
  const missingComponents = getMissingComponents(components, componentScores);
  const completionPercentage = calculateCompletionPercentage(components, componentScores);

  // Calculate weighted scores for each component
  const componentBreakdown = componentScores.map(cs => {
    // Normalize score to percentage (0-100)
    const normalizedScore = (cs.score / cs.maxScore) * 100;
    
    // Calculate weighted contribution based on its own weight
    const weightedScore = (normalizedScore * cs.weight) / 100;

    return {
      componentId: cs.componentId,
      componentType: cs.componentType,
      score: cs.score,
      maxScore: cs.maxScore,
      weight: cs.weight,
      weightedScore,
    };
  });

  // Sum all weighted scores to get raw sum
  let finalGrade = componentBreakdown.reduce(
    (sum, component) => sum + component.weightedScore,
    0
  );

  // Normalization Logic:
  // If weights don't sum to 100%, we treat the existing weights as the full scale
  // This allows "smooth" saving with just one component (even if its weight is not 100)
  if (totalDefinedWeight > 0 && totalDefinedWeight !== 100) {
    finalGrade = (finalGrade / totalDefinedWeight) * 100;
  }

  // Determine status
  let status: GradeStatus;
  if (!allGraded) {
    status = GradeStatus.PROVISIONAL;
  } else {
    status = GradeStatus.PENDING_REVIEW;
  }

  return {
    finalGrade: roundToTwoDecimals(finalGrade),
    status,
    isComplete: allGraded,
    completionPercentage: roundToTwoDecimals(completionPercentage),
    componentBreakdown,
    missingComponents: missingComponents.map(c => c.name),
  };
}

/**
 * Calculate partial grade (when not all components are graded)
 * Scales the grade based on completed components
 */
export function calculatePartialGrade(
  components: AssessmentComponent[],
  componentScores: ComponentScore[]
): WeightedGradeResult {
  if (componentScores.length === 0) {
    return {
      finalGrade: 0,
      status: GradeStatus.DRAFT,
      isComplete: false,
      completionPercentage: 0,
      componentBreakdown: [],
      missingComponents: components.map(c => c.name),
    };
  }

  // Calculate grade based on completed components only
  const result = calculateWeightedGrade(components, componentScores);
  
  // Scale the grade to account for missing components
  const completedWeight = componentScores.reduce((sum, cs) => sum + cs.weight, 0);
  const scaledGrade = (result.finalGrade / completedWeight) * 100;

  return {
    ...result,
    finalGrade: roundToTwoDecimals(scaledGrade),
    status: GradeStatus.PROVISIONAL,
  };
}

/**
 * Recalculate grade when component scores change
 */
export function recalculateGrade(
  components: AssessmentComponent[],
  componentScores: ComponentScore[]
): WeightedGradeResult {
  return calculateWeightedGrade(components, componentScores);
}

/**
 * Calculate what score is needed on remaining components to achieve target grade
 */
export function calculateRequiredScore(
  components: AssessmentComponent[],
  componentScores: ComponentScore[],
  targetGrade: number
): Array<{
  componentName: string;
  requiredScore: number;
  isAchievable: boolean;
}> {
  const missingComponents = getMissingComponents(components, componentScores);
  
  if (missingComponents.length === 0) {
    return [];
  }

  // Calculate current weighted score
  const currentResult = calculateWeightedGrade(components, componentScores);
  const currentScore = currentResult.finalGrade;

  // Calculate remaining weight
  const remainingWeight = missingComponents.reduce((sum, c) => sum + c.weight, 0);

  // Calculate required score on remaining components
  const requiredWeightedScore = targetGrade - currentScore;
  const requiredPercentage = (requiredWeightedScore / remainingWeight) * 100;

  return missingComponents.map(component => ({
    componentName: component.name,
    requiredScore: roundToTwoDecimals(requiredPercentage),
    isAchievable: requiredPercentage <= 100 && requiredPercentage >= 0,
  }));
}

/**
 * Get grade breakdown summary
 */
export function getGradeBreakdown(
  components: AssessmentComponent[],
  componentScores: ComponentScore[]
): {
  totalPossible: number;
  totalEarned: number;
  percentage: number;
  letterGrade?: string;
} {
  const result = calculateWeightedGrade(components, componentScores);

  return {
    totalPossible: 100,
    totalEarned: result.finalGrade,
    percentage: result.finalGrade,
  };
}

/**
 * Validate component score before adding
 */
export function validateComponentScore(
  component: AssessmentComponent,
  score: number
): { isValid: boolean; error?: string } {
  if (score < 0) {
    return {
      isValid: false,
      error: `Score cannot be negative: ${score}`,
    };
  }

  if (score > component.maxScore) {
    return {
      isValid: false,
      error: `Score ${score} exceeds maximum score of ${component.maxScore}`,
    };
  }

  return { isValid: true };
}

/**
 * Round number to two decimal places
 */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate grade statistics for a set of students
 */
export function calculateGradeStatistics(
  grades: number[]
): {
  mean: number;
  median: number;
  min: number;
  max: number;
  standardDeviation: number;
} {
  if (grades.length === 0) {
    return {
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      standardDeviation: 0,
    };
  }

  const sorted = [...grades].sort((a, b) => a - b);
  const sum = grades.reduce((acc, grade) => acc + grade, 0);
  const mean = sum / grades.length;

  const median =
    grades.length % 2 === 0
      ? (sorted[grades.length / 2 - 1] + sorted[grades.length / 2]) / 2
      : sorted[Math.floor(grades.length / 2)];

  const variance =
    grades.reduce((acc, grade) => acc + Math.pow(grade - mean, 2), 0) / grades.length;
  const standardDeviation = Math.sqrt(variance);

  return {
    mean: roundToTwoDecimals(mean),
    median: roundToTwoDecimals(median),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    standardDeviation: roundToTwoDecimals(standardDeviation),
  };
}









