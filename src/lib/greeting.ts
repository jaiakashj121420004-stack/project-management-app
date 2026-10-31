/** A time-of-day hello, so a page feels like it noticed you arrived. */
export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Burning the midnight oil';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Winding down';
}
