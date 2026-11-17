/**
 * Formats a string to Title Case.
 * Example: "JOHN DOE" -> "John Doe"
 * Example: "main branch" -> "Main Branch"
 */
export const toTitleCase = (str?: string | null): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Formats an email to lowercase and trims whitespace.
 * Example: " John.Doe@EXAMPLE.com " -> "john.doe@example.com"
 */
export const formatEmail = (email?: string | null): string => {
  if (!email) return '';
  return email.trim().toLowerCase();
};
