export function apiErrorMessage(value: unknown, status: number): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const body = value as Record<string, unknown>;
    if (body.error === "VALIDATION_ERROR" && Array.isArray(body.details)) {
      const issue = body.details.find((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).message === "string") as Record<string, unknown> | undefined;
      if (issue) {
        const path = Array.isArray(issue.path) ? issue.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number").join(".") : "";
        return `${path ? `${path}: ` : ""}${String(issue.message)}`;
      }
      return "Check the required fields and try again.";
    }
    if (typeof body.message === "string" && body.message) return body.message;
    if (typeof body.error === "string" && body.error) return body.error;
  }
  return `Request failed (${status}).`;
}
