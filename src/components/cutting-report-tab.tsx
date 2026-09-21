import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/kpi-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPKR, formatKgG, formatRate } from "@/lib/format";
import { displayDate } from "@/lib/date-range";
import { useCustomers, useProducts } from "@/hooks/use-master-data";
import { Search, Scissors } from "lucide-react";

export function CuttingReportTab({ from, to }: { from: string; to: string }) {
  const [productId, setProductId] = useState<string>("all");
  const [customerId, setCustomerId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const products = useProducts();
  const customers = useCustomers();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["cutting-report", from, to],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sale_items")
        .select("id, product_id, quantity_g, cutting_g, rate, line_total, products(name), sales!inner(id, sale_date, customer_id, reference_no, customers(name))")
        .gt("cutting_g", 0)
        .gte("sales.sale_date", from)
        .lte("sales.sale_date", to);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        item_id: r.id,
        sale_id: r.sales?.id,
        sale_date: r.sales?.sale_date,
        reference_no: r.sales?.reference_no,
        customer_id: r.sales?.customer_id,
        customer_name: r.sales?.customers?.name ?? "—",
        product_id: r.product_id,
        product_name: r.products?.name ?? "—",
        quantity_g: Number(r.quantity_g),
        cutting_g: Number(r.cutting_g ?? 0),
        rate: Number(r.rate),
      })).sort((a: any, b: any) => (a.sale_date < b.sale_date ? 1 : a.sale_date > b.sale_date ? -1 : 0));
    },
  });

  const filtered = useMemo(() => {
    return (rows ?? []).filter((r: any) => {
      if (productId !== "all" && r.product_id !== productId) return false;
      if (customerId !== "all" && r.customer_id !== customerId) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(r.product_name.toLowerCase().includes(q) || r.customer_name.toLowerCase().includes(q) || (r.reference_no ?? "").toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [rows, productId, customerId, search]);

  const totals = useMemo(() => {
    let cuttingG = 0, value = 0;
    const invoices = new Set<string>();
    for (const r of filtered) {
      cuttingG += r.cutting_g;
      value += Math.round((r.rate * r.cutting_g) / 1000 * 100) / 100;
      invoices.add(r.sale_id);
    }
    return { cuttingG, value, invoices: invoices.size, lines: filtered.length };
  }, [filtered]);

  return (
    <div className="mt-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <KPICard label="Total cutting" value={formatKgG(totals.cuttingG)} currency={false} icon={<Scissors className="h-4 w-4" />} />
        <KPICard label="Cutting value" value={totals.value} tone="warning" />
        <KPICard label="Invoices" value={totals.invoices} currency={false} />
        <KPICard label="Line items" value={totals.lines} currency={false} />
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search product, customer, ref…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-64" />
          </div>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All products" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {(products.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All customers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {(customers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{filtered.length}</span> lines • Cutting value <span className="font-semibold text-foreground tabular-nums">{formatPKR(totals.value)}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Cutting</TableHead>
                <TableHead className="text-right">Rate/kg</TableHead>
                <TableHead className="text-right">Cutting value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No cutting recorded in this range.</TableCell></TableRow>
              )}
              {filtered.map((r: any) => {
                const value = Math.round((r.rate * r.cutting_g) / 1000 * 100) / 100;
                return (
                  <TableRow key={r.item_id}>
                    <TableCell className="whitespace-nowrap">{displayDate(r.sale_date)}</TableCell>
                    <TableCell className="text-xs">{r.reference_no ?? "—"}</TableCell>
                    <TableCell>{r.customer_name}</TableCell>
                    <TableCell>{r.product_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatKgG(r.quantity_g)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatKgG(r.cutting_g)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRate(r.rate)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatRate(value)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
