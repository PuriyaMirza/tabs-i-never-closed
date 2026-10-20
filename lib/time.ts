// "3 weeks ago" style ages for the link cards.

// Always English so the server and the phone print the same words.
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago `then` was, as of `now` (both can be ISO strings, Dates or
 * milliseconds). Takes `now` as an argument so the result is predictable.
 */
export function timeAgo(then: string | number | Date, now: number): string {
  const seconds = Math.floor((now - new Date(then).getTime()) / 1000);
  if (Number.isNaN(seconds)) return "";
  // Clock differences between server and phone can make it slightly negative.
  if (seconds < MINUTE) return "just now";
  if (seconds < HOUR) return rtf.format(-Math.floor(seconds / MINUTE), "minute");
  if (seconds < DAY) return rtf.format(-Math.floor(seconds / HOUR), "hour");
  const days = Math.floor(seconds / DAY);
  if (days < 7) return rtf.format(-days, "day");
  if (days < 30) return rtf.format(-Math.floor(days / 7), "week");
  if (days < 365) return rtf.format(-Math.floor(days / 30), "month");
  return rtf.format(-Math.floor(days / 365), "year");
}
