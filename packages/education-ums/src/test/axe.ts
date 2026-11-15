/**
 * BMI UMS — Accessibility Testing Helper
 *
 * Provides a `checkA11y` utility that runs axe-core against a rendered React
 * component and throws descriptive errors if WCAG 2.1 AA violations are found.
 *
 * Usage in a test:
 *
 *   import { render } from '@testing-library/react';
 *   import { checkA11y } from '../test/axe';
 *
 *   it('has no critical accessibility violations', async () => {
 *     const { container } = render(<MyComponent />);
 *     await checkA11y(container);
 *   });
 */
import axe, { type AxeResults, type RunOptions } from 'axe-core';

/**
 * Run axe-core against a DOM node and assert no violations at critical/serious level.
 *
 * @param container - The DOM element rendered by @testing-library/react
 * @param options   - Optional axe RunOptions (tags, rules, etc.)
 */
export async function checkA11y(
  container: Element,
  options?: RunOptions
): Promise<AxeResults> {
  const results = await axe.run(container, {
    runOnly: {
      type: 'tag',
      // WCAG 2.1 Level A and AA
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
    ...options,
  });

  const violations = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );

  if (violations.length > 0) {
    const messages = violations
      .map(
        (v) =>
          `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
          v.nodes
            .slice(0, 3)
            .map((n) => `  • ${n.html}`)
            .join('\n')
      )
      .join('\n\n');

    throw new Error(
      `Found ${violations.length} WCAG critical/serious accessibility violation(s):\n\n${messages}\n\n` +
      `Full axe results: ${JSON.stringify(results.violations, null, 2)}`
    );
  }

  return results;
}

/**
 * Get all violations (including minor) for reporting purposes.
 * Does not throw — use for warning-level checks.
 */
export async function getA11yViolations(
  container: Element,
  options?: RunOptions
) {
  const results = await axe.run(container, options || {});
  return results.violations;
}









