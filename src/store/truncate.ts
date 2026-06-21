export function truncateText(s: string, limit = 25000): { text: string; truncated: boolean } {
  if (s.length <= limit) return { text: s, truncated: false };
  return { text: s.slice(0, limit), truncated: true };
}
