import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { KPICard } from "@/components/kpi-card";
import { DateRangeSelect, useDateRange } from "@/components/date-range-select";
import { formatPKR, formatKg } from "@/lib/format";
import { displayDate } from "@/lib/date-range";
import {
  chartAxis, chartGrid, chartLegend, chartMargin, chartTooltipStyle, compactNumber,
} from "@/lib/chart-theme";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import { Wallet, ShoppingCart, Receipt, Coins, Landmark, ArrowDownCircle, ArrowUpCircle, Scale } from "lucide-react";
import { format, eachDayOfInterval } from "date-fns";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Dashboard — GUL Paper" }] }),
  component: Dashboard,
});

function Dashboard() {
  const dr = useDateRange("month");
  const fromISO = dr.range.from.toISOString();
  const toISO = dr.range.to.toISOString();
  const fromDate = format(dr.range.from, "yyyy-MM-dd");
  const toDate = format(dr.range.to, "yyyy-MM-dd");

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary", fromISO, toISO],
    queryFn: async () => {
      const [sales, services, purchases, expenses, cashBal, bankBal, partyBal] = await Promise.all([
        (supabase as any).from("sales").select("total_amount,sale_date,sale_items(quantity_g,cutting_g)").gte("sale_date", fromDate).lte("sale_date", toDate),
        (supabase as any).from("service_sales").select("amount,sale_date").gte("sale_date", fromDate).lte("sale_date", toDate),
        (supabase as any).from("purchases").select("total_amount,purchase_date,purchase_items(quantity_g)").gte("purchase_date", fromDate).lte("purchase_date", toDate),
        (supabase as any).from("expenses").select("amount,paid_by,expense_date").gte("expense_date", fromDate).lte("expense_date", toDate),
        (supabase as any).from("cash_balance").select("current_cash").maybeSingle(),
        (supabase as any).from("bank_balances").select("current_balance,bank_name,account_title"),
        (supabase as any).from("party_balances").select("party_type,balance"),
      ]);
      return {
        sales: sales.data ?? [],
        services: services.data ?? [],
        purchases: purchases.data ?? [],
        expenses: expenses.data ?? [],
        cashCurrent: Number(cashBal.data?.current_cash ?? 0),
        banks: (bankBal.data ?? []) as { bank_name: string; account_title: string; current_balance: number }[],
        parties: (partyBal.data ?? []) as { party_type: string; balance: number }[],
      };
    },
  });

  const totalProductSales = (summary?.sales ?? []).reduce((s: number, r: any) => s + Number(r.total_amount), 0);
  const totalServiceRevenue = (summary?.services ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalSales = totalProductSales + totalServiceRevenue;
  const totalPurchases = (summary?.purchases ?? []).reduce((s: number, r: any) => s + Number(r.total_amount), 0);
  const totalExpenses = (summary?.expenses ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
  const netProfit = totalSales - totalPurchases - totalExpenses;
  const bankTotal = (summary?.banks ?? []).reduce((s, b) => s + Number(b.current_balance ?? 0), 0);
  const totalReceivable = (summary?.parties ?? []).filter((p) => p.party_type === "customer").reduce((s, p) => s + Number(p.balance ?? 0), 0);
  const totalPayable = (summary?.parties ?? []).filter((p) => p.party_type === "supplier").reduce((s, p) => s + Number(p.balance ?? 0), 0);
  const totalPurchaseGrams = (summary?.purchases ?? []).reduce(
    (s: number, r: any) => s + (r.purchase_items ?? []).reduce((g: number, it: any) => g + Number(it.quantity_g || 0), 0),
    0,
  );
  const totalSaleGrams = (summary?.sales ?? []).reduce(
    (s: number, r: any) => s + (r.sale_items ?? []).reduce((g: number, it: any) => g + Math.max(Number(it.quantity_g || 0) - Number(it.cutting_g || 0), 0), 0),
    0,
  );

  // Daily aggregate
  const days = eachDayOfInterval({ start: dr.range.from, end: dr.range.to });
  const dailyMap: Record<string, { date: string; sales: number; purchases: number; expenses: number }> = {};
  for (const d of days) {
    const k = format(d, "yyyy-MM-dd");
    dailyMap[k] = { date: format(d, "dd MMM"), sales: 0, purchases: 0, expenses: 0 };
  }
  (summary?.sales ?? []).forEach((r: any) => { const k = r.sale_date; if (dailyMap[k]) dailyMap[k].sales += Number(r.total_amount); });
  (summary?.services ?? []).forEach((r: any) => { const k = r.sale_date; if (dailyMap[k]) dailyMap[k].sales += Number(r.amount); });
  (summary?.purchases ?? []).forEach((r: any) => { const k = r.purchase_date; if (dailyMap[k]) dailyMap[k].purchases += Number(r.total_amount); });
  (summary?.expenses ?? []).forEach((r: any) => { const k = r.expense_date; if (dailyMap[k]) dailyMap[k].expenses += Number(r.amount); });
  const daily = Object.values(dailyMap);
  const cumulative = daily.reduce<{ date: string; sales: number; purchases: number; expenses: number }[]>((acc, d) => {
    const prev = acc[acc.length - 1] ?? { sales: 0, purchases: 0, expenses: 0 };
    acc.push({ date: d.date, sales: prev.sales + d.sales, purchases: prev.purchases + d.purchases, expenses: prev.expenses + d.expenses });
    return acc;
  }, []);

  const sectionLabel =
    "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Overview from ${displayDate(dr.range.from)} to ${displayDate(dr.range.to)}`}
        actions={<DateRangeSelect {...dr} />}
      />

      {/* Headline figures for the selected period — the four numbers you check first. */}
      <section className="space-y-3">
        <h2 className={sectionLabel}>This period</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPICard label="Sales" value={totalSales} tone="success" icon={<Receipt className="h-4 w-4" />} />
          <KPICard label="Purchases" value={totalPurchases} tone="info" icon={<ShoppingCart className="h-4 w-4" />} />
          <KPICard label="Expenses" value={totalExpenses} tone="warning" icon={<Coins className="h-4 w-4" />} />
          <KPICard
            label="Net"
            value={netProfit}
            tone={netProfit >= 0 ? "success" : "destructive"}
            hint="Sales − purchases − expenses"
            icon={<Wallet className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Standing balances and tonnage — reference figures, one tier down. */}
      <section className="space-y-3">
        <h2 className={sectionLabel}>Volume &amp; position</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KPICard label="Sale weight" value={formatKg(totalSaleGrams)} currency={false} icon={<Scale className="h-4 w-4" />} />
          <KPICard label="Purchase weight" value={formatKg(totalPurchaseGrams)} currency={false} icon={<Scale className="h-4 w-4" />} />
          <KPICard label="Total in banks" value={bankTotal} icon={<Landmark className="h-4 w-4" />} />
          <KPICard label="Receivable" value={totalReceivable} tone="success" hint="From customers" icon={<ArrowDownCircle className="h-4 w-4" />} />
          <KPICard label="Payable" value={totalPayable} tone="destructive" hint="To suppliers" icon={<ArrowUpCircle className="h-4 w-4" />} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold">Daily activity</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sales, purchases and expenses per day
            </p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={chartMargin}>
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="date" {...chartAxis} />
                <YAxis {...chartAxis} tickFormatter={compactNumber} width={52} />
                <Tooltip
                  formatter={(v: number) => formatPKR(v)}
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  contentStyle={chartTooltipStyle}
                />
                <Legend {...chartLegend} />
                <Bar dataKey="sales" name="Sales" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="purchases" name="Purchases" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <h3 className="font-display text-base font-semibold">Balances</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Cash and bank accounts right now</p>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/[0.06] p-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground">Cash on hand</div>
                <div className="mt-0.5 font-display text-lg font-semibold tabular-nums text-primary">
                  {formatPKR(summary?.cashCurrent ?? 0)}
                </div>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
            </div>

            {(summary?.banks ?? []).map((b) => (
              <div
                key={b.bank_name + b.account_title}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{b.bank_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{b.account_title}</div>
                </div>
                <div className="shrink-0 font-display text-sm font-semibold tabular-nums">
                  {formatPKR(b.current_balance)}
                </div>
              </div>
            ))}

            {(summary?.banks ?? []).length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                No bank accounts yet — add one from the Banks page.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <div className="mb-4">
          <h3 className="font-display text-base font-semibold">Cumulative trend</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Running totals across the selected period
          </p>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulative} margin={chartMargin}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="date" {...chartAxis} />
              <YAxis {...chartAxis} tickFormatter={compactNumber} width={52} />
              <Tooltip formatter={(v: number) => formatPKR(v)} contentStyle={chartTooltipStyle} />
              <Legend {...chartLegend} />
              <Line type="monotone" dataKey="sales" name="Sales" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="purchases" name="Purchases" stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke="var(--chart-3)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
