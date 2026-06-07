const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isValidIsoDate = (s: string): boolean => ISO_DATE_RE.test(s);

export const todayInTimezone = (
  timezone: string,
  now: Date = new Date()
): string => {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
};
