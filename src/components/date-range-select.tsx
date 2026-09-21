import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeRange, isoDate, type DateRange, type RangeKey } from "@/lib/date-range";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export function useDateRange(initial: RangeKey = "today") {
  const [rangeKey, setKey] = useState<RangeKey>(initial);
  const [from, setFrom] = useState<string>(isoDate(new Date()));
  const [to, setTo] = useState<string>(isoDate(new Date()));
  const range: DateRange = useMemo(
    () => computeRange(rangeKey, rangeKey === "custom" ? { from: new Date(from), to: new Date(to) } : undefined),
    [rangeKey, from, to],
  );
  return { rangeKey, setKey, from, setFrom, to, setTo, range };
}

export function DateRangeSelect(props: ReturnType<typeof useDateRange>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={props.rangeKey} onValueChange={(v) => props.setKey(v as RangeKey)}>
        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="yesterday">Yesterday</SelectItem>
          <SelectItem value="week">This week</SelectItem>
          <SelectItem value="month">This month</SelectItem>
          <SelectItem value="year">This year</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>
      {props.rangeKey === "custom" && (
        <>
          <Input type="date" value={props.from} onChange={(e) => props.setFrom(e.target.value)} className="w-[160px]" />
          <span className="text-muted-foreground text-xs">to</span>
          <Input type="date" value={props.to} onChange={(e) => props.setTo(e.target.value)} className="w-[160px]" />
        </>
      )}
    </div>
  );
}

