const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

/** Returns today's date string in Vietnam timezone (YYYY-MM-DD). */
export function todayVN(): string {
  return new Date(Date.now() + VN_OFFSET_MS).toISOString().split('T')[0];
}

/** Returns a Date adjusted to UTC+7 midnight for N days ago (for range queries). */
export function daysAgoVN(n: number): string {
  return new Date(Date.now() + VN_OFFSET_MS - n * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
}

export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}
