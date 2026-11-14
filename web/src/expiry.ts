export function formatExpiry(years: number, baseDate: string): string {
  const date = new Date(baseDate);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
