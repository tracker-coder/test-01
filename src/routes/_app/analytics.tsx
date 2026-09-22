import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DateRangeSelect, useDateRange } from "@/components/date-range-select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { formatPKR } from "@/lib/format";
import { format, eachMonthOfInterval } from "date-fns";
import {
  CHART_COLORS, chartAxis, chartGrid, chartLegend, chartMargin, chartTooltipStyle, compactNumber,
} from "@/lib/chart-theme";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — GUL Paper" }] }),
  component: AnalyticsPage,
});

const COLORS = CHART_COLORS;

function AnalyticsPage() {
  const dr = useDateRange("year");
  const from = format(dr.range.from, "yyyy-MM-dd");
  const to = format(dr.range.to, "yyyy-MM-dd");

  const q = useQuery({
    queryKey: ["analytics", from, to],
    queryFn: async () => {
      const [sales, purchases, expenses] = await Promise.all([
        (supabase as any).from("sales").select("total_amount,sale_date,customer_id,customers(name),sale_items(line_total,products(name))").gte("sale_date", from).lte("sale_date", to),
        (supabase as any).from("purchases").select("total_amount,purchase_date,supplier_id,suppliers(name)").gte("purchase_date", from).lte("purchase_date", to),
        (supabase as any).from("expenses").select("amount,expense_date,category_id,expense_categories(name)").gte("expense_date", from).lte("expense_date", to),
      ]);
      return { sales: sales.data ?? [], purchases: purchases.data ?? [], expenses: expenses.data ?? [] };
    },
  });

  const months = eachMonthOfInterval({ start: dr.range.from, end: dr.range.to });
  const monthly = months.map((m) => ({ month: format(m, "MMM yy"), key: format(m, "yyyy-MM"), sales: 0, purchases: 0, expenses: 0, profit: 0 }));
  const midx: Record<string, number> = {};
  monthly.forEach((r, i) => (midx[r.key] = i));
  (q.data?.sales ?? []).forEach((r: any) => { const k = r.sale_date.slice(0, 7); if (midx[k] != null) monthly[midx[k]].sales += Number(r.total_amount); });
  (q.data?.purchases ?? []).forEach((r: any) => { const k = r.purchase_date.slice(0, 7); if (midx[k] != null) monthly[midx[k]].purchases += Number(r.total_amount); });
  (q.data?.expenses ?? []).forEach((r: any) => { const k = r.expense_date.slice(0, 7); if (midx[k] != null) monthly[midx[k]].expenses += Number(r.amount); });
  monthly.forEach((r) => (r.profit = r.sales - r.purchases - r.expenses));

  const groupBy = <T extends { name: string; value: number }>(items: any[], nameFn: (r: any) => string, valueFn: (r: any) => number): T[] => {
    const map = new Map<string, number>();
    items.forEach((r) => { const n = nameFn(r) || "—"; map.set(n, (map.get(n) ?? 0) + valueFn(r)); });
    return Array.from(map, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6) as T[];
  };
  const productLines = (q.data?.sales ?? []).flatMap((r: any) => r.sale_items ?? []);
  const topCustomers = groupBy(q.data?.sales ?? [], (r) => r.customers?.name, (r) => Number(r.total_amount));
  const topProducts = groupBy(productLines, (r: any) => r.products?.name, (r: any) => Number(r.line_total));
  const topSuppliers = groupBy(q.data?.purchases ?? [], (r) => r.suppliers?.name, (r) => Number(r.total_amount));
  const expensesByCat = groupBy(q.data?.expenses ?? [], (r) => r.expense_categories?.name, (r) => Number(r.amount));


  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Trends and insights across your operations." actions={<DateRangeSelect {...dr} />} />

      <div className="panel p-5">
        <div className="mb-4">
          <h3 className="font-display text-base font-semibold">Monthly trend</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Sales, purchases and expenses by month</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={monthly} margin={chartMargin}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="month" {...chartAxis} />
              <YAxis {...chartAxis} tickFormatter={compactNumber} width={52} />
              <Tooltip formatter={(v: number) => formatPKR(v)} contentStyle={chartTooltipStyle} />
              <Legend {...chartLegend} />
              <Bar dataKey="sales" name="Sales" fill={COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="purchases" name="Purchases" fill={COLORS[1]} radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="expenses" name="Expenses" fill={COLORS[2]} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel p-5">
        <div className="mb-4">
          <h3 className="font-display text-base font-semibold">Monthly profit</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Sales minus purchases and expenses</p>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={monthly} margin={chartMargin}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="month" {...chartAxis} />
              <YAxis {...chartAxis} tickFormatter={compactNumber} width={52} />
              <Tooltip formatter={(v: number) => formatPKR(v)} contentStyle={chartTooltipStyle} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke={COLORS[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="Top products (sales)" data={topProducts} />
        <BreakdownCard title="Top customers" data={topCustomers} />
        <BreakdownCard title="Top suppliers" data={topSuppliers} />
        <BreakdownCard title="Expenses by category" data={expensesByCat} />
      </div>
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="panel p-5">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {data.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No data for this period.
        </p>
      ) : (
        <>
          <div className="mt-3 h-40">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60} paddingAngle={2}>
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatPKR(v)} contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-2.5 text-sm">
            {data.map((d, i) => {
              const pct = total ? (d.value / total) * 100 : 0;
              return (
                <li key={d.name}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatPKR(d.value)}
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        ({Math.round(pct)}%)
                      </span>
                    </span>
                  </div>
                  {/* Share bar — makes the ranking readable without reading the numbers. */}
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
