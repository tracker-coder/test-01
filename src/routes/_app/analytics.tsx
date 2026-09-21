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

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — GUL Paper" }] }),
  component: AnalyticsPage,
});

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

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
    <div>
      <PageHeader title="Analytics" description="Trends and insights across your operations." actions={<DateRangeSelect {...dr} />} />

      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-display font-semibold">Monthly trend</h3>
        <div className="h-72 mt-2">
          <ResponsiveContainer>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => new Intl.NumberFormat("en-PK", { notation: "compact" }).format(v)} />
              <Tooltip formatter={(v: number) => formatPKR(v)} />
              <Legend />
              <Bar dataKey="sales" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="purchases" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 mt-4">
        <h3 className="font-display font-semibold">Monthly profit</h3>
        <div className="h-56 mt-2">
          <ResponsiveContainer>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => new Intl.NumberFormat("en-PK", { notation: "compact" }).format(v)} />
              <Tooltip formatter={(v: number) => formatPKR(v)} />
              <Line type="monotone" dataKey="profit" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 mt-4 lg:grid-cols-2">
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
    <div className="rounded-xl border bg-card p-4">
      <h3 className="font-display font-semibold">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-4">No data.</p>
      ) : (
        <>
          <div className="h-40 mt-2">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60} paddingAngle={2}>
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatPKR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {data.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 truncate">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="truncate">{d.name}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatPKR(d.value)} <span className="text-[11px]">({total ? Math.round((d.value / total) * 100) : 0}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
