import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { KPICard } from "@/components/kpi-card";
import { DateRangeSelect, useDateRange } from "@/components/date-range-select";
import { formatPKR, formatKg } from "@/lib/format";
import { displayDate } from "@/lib/date-range";
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

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Overview from ${displayDate(dr.range.from)} to ${displayDate(dr.range.to)}`}
        actions={<DateRangeSelect {...dr} />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9">
        <KPICard label="Sales" value={totalSales} tone="success" icon={<Receipt className="h-4 w-4" />} />
        <KPICard label="Sale weight" value={formatKg(totalSaleGrams)} currency={false} icon={<Scale className="h-4 w-4" />} />
        <KPICard label="Purchases" value={totalPurchases} icon={<ShoppingCart className="h-4 w-4" />} />
        <KPICard label="Purchase weight" value={formatKg(totalPurchaseGrams)} currency={false} icon={<Scale className="h-4 w-4" />} />
        <KPICard label="Expenses" value={totalExpenses} tone="destructive" icon={<Coins className="h-4 w-4" />} />
        <KPICard label="Net (period)" value={netProfit} tone={netProfit >= 0 ? "success" : "destructive"} icon={<Wallet className="h-4 w-4" />} />
        <KPICard label="Total in Banks" value={bankTotal} icon={<Landmark className="h-4 w-4" />} />
        <KPICard label="Total Receivable" value={totalReceivable} tone="success" hint="From customers" icon={<ArrowDownCircle className="h-4 w-4" />} />
        <KPICard label="Total Payable" value={totalPayable} tone="destructive" hint="To suppliers" icon={<ArrowUpCircle className="h-4 w-4" />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Daily activity</h3>
              <p className="text-xs text-muted-foreground">Sales, purchases and expenses per day</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => new Intl.NumberFormat("en-PK", { notation: "compact" }).format(v)} />
                <Tooltip formatter={(v: number) => formatPKR(v)} cursor={{ fill: "hsl(var(--muted))" }} />
                <Legend />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-display text-base font-semibold">Balances</h3>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-md bg-muted p-3">
              <div>
                <div className="text-xs text-muted-foreground">Cash on hand</div>
                <div className="font-display text-lg font-semibold tabular-nums">{formatPKR(summary?.cashCurrent ?? 0)}</div>
              </div>
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </div>
            {(summary?.banks ?? []).map((b) => (
              <div key={b.bank_name + b.account_title} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">{b.bank_name}</div>
                  <div className="text-xs text-muted-foreground">{b.account_title}</div>
                </div>
                <div className="font-display text-sm font-semibold tabular-nums">{formatPKR(b.current_balance)}</div>
              </div>
            ))}
            {(summary?.banks ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground p-3">No bank accounts yet — add one from the Banks page.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-card p-4">
        <h3 className="font-display text-base font-semibold">Cumulative trend</h3>
        <div className="h-64 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulative}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => new Intl.NumberFormat("en-PK", { notation: "compact" }).format(v)} />
              <Tooltip formatter={(v: number) => formatPKR(v)} />
              <Legend />
              <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="purchases" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
