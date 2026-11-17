export function calculateGrade(score: number | null, maxScore: number | null): { letter_grade: string; grade_point: number } {
  let letter_grade = '';
  let grade_point = 0;

  if (score != null && maxScore != null && maxScore > 0) {
    const p = (score / maxScore) * 100;
    if (p >= 70) { letter_grade = 'A'; grade_point = 4.0; }
    else if (p >= 60) { letter_grade = 'B'; grade_point = 3.0; }
    else if (p >= 50) { letter_grade = 'C'; grade_point = 2.0; }
    else if (p >= 40) { letter_grade = 'D'; grade_point = 1.0; }
    else { letter_grade = 'F'; grade_point = 0.0; }
  } else if (score === 0 && maxScore === 0) {
    letter_grade = 'N/A';
  } else {
    letter_grade = 'N/A';
  }

  return { letter_grade, grade_point };
}

export function percentageToGrade(p: number): { letter_grade: string; grade_point: number } {
  let letter_grade = '';
  let grade_point = 0;
  if (p >= 70) { letter_grade = 'A'; grade_point = 4.0; }
  else if (p >= 60) { letter_grade = 'B'; grade_point = 3.0; }
  else if (p >= 50) { letter_grade = 'C'; grade_point = 2.0; }
  else if (p >= 40) { letter_grade = 'D'; grade_point = 1.0; }
  else { letter_grade = 'F'; grade_point = 0.0; }
  return { letter_grade, grade_point };
}
