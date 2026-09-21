import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatKgG } from "@/lib/format";
import { Search, Package } from "lucide-react";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({ meta: [{ title: "Inventory — GUL Paper" }] }),
  component: InventoryPage,
});

type Row = { product_id: string; name: string; opening_g: number; purchased_g: number; sold_g: number; stock_g: number };

function InventoryPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async (): Promise<Row[]> => {
      const [prodRes, openRes, purRes, saleRes] = await Promise.all([
        (supabase as any).from("products").select("id, name").order("name"),
        (supabase as any).from("product_openings").select("product_id, quantity_g"),
        (supabase as any).from("purchase_items").select("product_id, quantity_g"),
        (supabase as any).from("sale_items").select("product_id, quantity_g"),
      ]);
      for (const r of [prodRes, openRes, purRes, saleRes]) if (r.error) throw r.error;
      const opening = new Map<string, number>();
      (openRes.data ?? []).forEach((r: any) => opening.set(r.product_id, (opening.get(r.product_id) ?? 0) + Number(r.quantity_g)));
      const purchased = new Map<string, number>();
      (purRes.data ?? []).forEach((r: any) => purchased.set(r.product_id, (purchased.get(r.product_id) ?? 0) + Number(r.quantity_g)));
      const sold = new Map<string, number>();
      (saleRes.data ?? []).forEach((r: any) => sold.set(r.product_id, (sold.get(r.product_id) ?? 0) + Number(r.quantity_g)));
      return (prodRes.data ?? []).map((p: any) => {
        const o = opening.get(p.id) ?? 0;
        const pu = purchased.get(p.id) ?? 0;
        const s = sold.get(p.id) ?? 0;
        return { product_id: p.id, name: p.name, opening_g: o, purchased_g: pu, sold_g: s, stock_g: o + pu - s };
      });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [data, search]);

  const totalStock = filtered.reduce((s, r) => s + r.stock_g, 0);

  return (
    <div>
      <PageHeader title="Inventory" description="Current stock = opening + purchased − sold, per product." />

      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search product…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-72" />
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{filtered.length}</span> products • Total stock <span className="font-semibold text-foreground tabular-nums">{formatKgG(totalStock)}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Purchased</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">In stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No products yet.</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.product_id}>
                  <TableCell className="font-medium flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" />{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatKgG(r.opening_g)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatKgG(r.purchased_g)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatKgG(r.sold_g)}</TableCell>
                  <TableCell className={"text-right tabular-nums font-semibold " + (r.stock_g < 0 ? "text-destructive" : "")}>{formatKgG(r.stock_g)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
