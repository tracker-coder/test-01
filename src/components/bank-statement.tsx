import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRangeSelect, useDateRange } from "@/components/date-range-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KPICard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { shareOnWhatsApp } from "@/lib/whatsapp";
import { formatMoney, formatPKR } from "@/lib/format";
import { displayDate, isoDate } from "@/lib/date-range";
import { Badge } from "@/components/ui/badge";

const SOURCE_LABELS: Record<string, string> = {
  sale: "Sale",
  purchase: "Purchase",
  expense: "Expense",
  party_payment: "Party payment",
  service_sale: "Service",
  transfer: "Cash transfer",
};

interface Props {
  bankId: string;
  bankName: string;
  accountTitle: string;
  openingBalance: number;
}

export function BankStatement({ bankId, bankName, accountTitle, openingBalance }: Props) {
  const dr = useDateRange("month");
  const fromIso = isoDate(dr.range.from);
  const toIso = isoDate(dr.range.to);

  // Total in/out BEFORE range start to compute opening balance for the range
  const { data: priorTotals } = useQuery({
    queryKey: ["bank-ledger-prior", bankId, fromIso],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bank_ledger")
        .select("direction,amount")
        .eq("bank_id", bankId)
        .lt("tx_date", fromIso);
      if (error) throw error;
      let inSum = 0, outSum = 0;
      for (const r of data as any[]) {
        if (r.direction === "in") inSum += Number(r.amount);
        else outSum += Number(r.amount);
      }
      return { inSum, outSum };
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["bank-ledger", bankId, fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bank_ledger")
        .select("*")
        .eq("bank_id", bankId)
        .gte("tx_date", fromIso)
        .lte("tx_date", toIso)
        .order("tx_date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const rangeOpening = Number(openingBalance ?? 0) + (priorTotals?.inSum ?? 0) - (priorTotals?.outSum ?? 0);

  const { totalIn, totalOut, withBalance } = useMemo(() => {
    let running = rangeOpening;
    let tIn = 0, tOut = 0;
    const withBalance = (rows ?? []).map((r: any) => {
      const amt = Number(r.amount);
      if (r.direction === "in") { running += amt; tIn += amt; }
      else { running -= amt; tOut += amt; }
      return { ...r, running };
    });
    return { totalIn: tIn, totalOut: tOut, withBalance };
  }, [rows, rangeOpening]);

  const closing = rangeOpening + totalIn - totalOut;

  const share = () => {
    const lines = [
      `*Bank Statement — ${bankName}*`,
      `Account: ${accountTitle}`,
      `Period: ${displayDate(dr.range.from)} to ${displayDate(dr.range.to)}`,
      ``,
      `Opening: ${formatPKR(rangeOpening)}`,
      `In: ${formatPKR(totalIn)}`,
      `Out: ${formatPKR(totalOut)}`,
      `*Closing: ${formatPKR(closing)}*`,
      ``,
      ...withBalance.slice(0, 40).map((r: any) =>
        `${displayDate(r.tx_date)} • ${SOURCE_LABELS[r.source_type] ?? r.source_type} • ${r.direction === "in" ? "+" : "-"}${formatPKR(r.amount)}`,
      ),
      withBalance.length > 40 ? `…and ${withBalance.length - 40} more` : "",
    ].filter(Boolean);
    shareOnWhatsApp(lines.join("\n"));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateRangeSelect {...dr} />
        <Button variant="outline" size="sm" onClick={share} className="gap-1">
          <WhatsAppIcon className="h-4 w-4 text-success" /> Share
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KPICard label="Opening" value={rangeOpening} />
        <KPICard label="In" value={totalIn} tone="success" />
        <KPICard label="Out" value={totalOut} tone="destructive" />
        <KPICard label="Closing" value={closing} tone="success" />
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto max-h-[55vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            )}
            {!isLoading && withBalance.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No transactions in this period.</TableCell></TableRow>
            )}
            {withBalance.map((r: any) => (
              <TableRow key={`${r.source_type}-${r.source_id}`}>
                <TableCell className="whitespace-nowrap">{displayDate(r.tx_date)}</TableCell>
                <TableCell><Badge variant="secondary">{SOURCE_LABELS[r.source_type] ?? r.source_type}</Badge></TableCell>
                <TableCell className="max-w-[280px] truncate" title={r.note ?? ""}>{r.note}</TableCell>
                <TableCell className="text-right tabular-nums text-success">{r.direction === "in" ? formatMoney(r.amount) : ""}</TableCell>
                <TableCell className="text-right tabular-nums text-destructive">{r.direction === "out" ? formatMoney(r.amount) : ""}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatMoney(r.running)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
