import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, format } from "date-fns";

export type RangeKey = "today" | "yesterday" | "week" | "month" | "year" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  key: RangeKey;
}

export function computeRange(key: RangeKey, custom?: { from: Date; to: Date }): DateRange {
  const now = new Date();
  switch (key) {
    case "today": return { key, from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { key, from: startOfDay(y), to: endOfDay(y) };
    }
    case "week": return { key, from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month": return { key, from: startOfMonth(now), to: endOfMonth(now) };
    case "year": return { key, from: startOfYear(now), to: endOfYear(now) };
    case "custom": return { key, from: custom?.from ?? startOfMonth(now), to: custom?.to ?? endOfMonth(now) };
  }
}

export const isoDate = (d: Date) => format(d, "yyyy-MM-dd");
export const displayDate = (d: string | Date) => format(new Date(d), "dd MMM yyyy");
export const displayDateTime = (d: string | Date) => format(new Date(d), "dd MMM yyyy, HH:mm");
