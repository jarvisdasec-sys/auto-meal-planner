/** Convert a snake_case value like "air_fried" into "Air Fried" for display. */
export function formatLabel(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
