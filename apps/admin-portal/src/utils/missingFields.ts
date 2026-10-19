// Builds a "required" error naming only the fields that are actually empty,
// e.g. "Color is required." or "Year, make, and color are required."
// Keys are the field labels, in display order. Returns '' when nothing is missing.
export function missingFieldsMessage(fields: Record<string, string>): string {
  const missing = Object.entries(fields)
    .filter(([, value]) => !value.trim())
    .map(([label], i) => (i === 0 ? label : label.toLowerCase()));
  if (missing.length === 0) return '';
  if (missing.length === 1) return `${missing[0]} is required.`;
  if (missing.length === 2) return `${missing[0]} and ${missing[1]} are required.`;
  return `${missing.slice(0, -1).join(', ')}, and ${missing[missing.length - 1]} are required.`;
}
