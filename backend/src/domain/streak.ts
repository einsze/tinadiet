const dayBefore = (yyyymmdd: string): string => {
  const d = new Date(`${yyyymmdd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export const computeStreakFromDates = (
  sortedDescDates: string[],
  today: string
): number => {
  if (sortedDescDates.length === 0) return 0;
  const set = new Set(sortedDescDates);
  let streak = 0;
  let cursor = set.has(today) ? today : dayBefore(today);
  while (set.has(cursor)) {
    streak += 1;
    cursor = dayBefore(cursor);
  }
  return streak;
};
