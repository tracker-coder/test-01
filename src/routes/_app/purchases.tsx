import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DateRangeSelect, useDateRange } from "@/components/date-range-select";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatPKR, formatMoney, formatRate, formatKgG, formatKg, gramsToKgGram } from "@/lib/format";
import { KPICard } from "@/components/kpi-card";
import { FileText, Scale, Wallet, TrendingUp } from "lucide-react";
import { displayDate } from "@/lib/date-range";
import { useSuppliers, useProducts, useLastRates, useBanks } from "@/hooks/use-master-data";
import { useIsAdmin } from "@/hooks/use-role";
import { Plus, Trash2, Search, Eye, Pencil } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { shareOnWhatsApp } from "@/lib/whatsapp";

function buildPurchaseMessage(r: any) {
  const items = (r.purchase_items ?? [])
    .map((it: any) => `• ${it.products?.name ?? "—"} — ${formatKgG(it.quantity_g)} @ ${formatPKR(it.rate)}/kg = ${formatPKR(it.line_total)}`)
    .join("\n");
  const totalGrams = (r.purchase_items ?? []).reduce((g: number, it: any) => g + Number(it.quantity_g || 0), 0);
  const paid = r.paid_by === "cash" ? "Cash" : r.paid_by === "credit" ? "Credit (unpaid)" : (r.banks?.bank_name ?? "Bank");
  return [
    `*Purchase Invoice — GUL Paper*`,
    `Date: ${displayDate(r.purchase_date)}`,
    `Supplier: ${r.suppliers?.name ?? "—"}`,
    `Paid by: ${paid}`,
    ``,
    items || "(no items)",
    ``,
    `Weight: ${formatKg(totalGrams)}`,
    `*Total: ${formatPKR(r.total_amount)}*`,
    r.notes ? `\nNotes: ${r.notes}` : "",
  ].filter(Boolean).join("\n");
}


export const Route = createFileRoute("/_app/purchases")({
  head: () => ({ meta: [{ title: "Purchases — GUL Paper" }] }),
  component: PurchasesPage,
});

function PurchasesPage() {
  const dr = useDateRange("month");
  const [search, setSearch] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();

  const from = format(dr.range.from, "yyyy-MM-dd");
  const to = format(dr.range.to, "yyyy-MM-dd");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["purchases", from, to],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("purchases")
        .select("*, suppliers(name), banks(bank_name,account_title), purchase_items(id, product_id, quantity_g, rate, line_total, products(name))")
        .gte("purchase_date", from)
        .lte("purchase_date", to)
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const total = (rows ?? []).reduce((s, r: any) => s + Number(r.total_amount), 0);
  const totalGrams = (rows ?? []).reduce(
    (s, r: any) => s + (r.purchase_items ?? []).reduce((g: number, it: any) => g + Number(it.quantity_g || 0), 0),
    0,
  );
  const avgRatePerKg = totalGrams > 0 ? (total * 1000) / totalGrams : 0;
  const filtered = (rows ?? []).filter((r: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if (r.suppliers?.name?.toLowerCase().includes(q)) return true;
    if ((r.notes ?? "").toLowerCase().includes(q)) return true;
    return (r.purchase_items ?? []).some((it: any) => it.products?.name?.toLowerCase().includes(q));
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase deleted");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e: any) => toast.error(e.message || "Delete failed"),
  });

  const viewing = (rows ?? []).find((r: any) => r.id === viewId);

  return (
    <div>
      <PageHeader
        title="Purchases"
        description="Multi-item invoices. Pay by cash, from a bank, or on credit."
        actions={
          <>
            <DateRangeSelect {...dr} />
            <Button size="sm" asChild className="gap-1">
              <Link to="/purchases/new"><Plus className="h-4 w-4" /> New purchase</Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard label="Invoices" value={(rows ?? []).length} currency={false} icon={<FileText className="h-4 w-4" />} />
        <KPICard label="Total weight" value={formatKg(totalGrams)} currency={false} icon={<Scale className="h-4 w-4" />} />
        <KPICard label="Total amount" value={total} icon={<Wallet className="h-4 w-4" />} />
        <KPICard label="Avg rate / kg" value={avgRatePerKg > 0 ? formatRate(avgRatePerKg) : "—"} currency={false} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search supplier, product, notes…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-72" />
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{filtered.length}</span> invoices • <span className="font-semibold text-foreground tabular-nums">{formatKg(totalGrams)}</span> • Total <span className="font-semibold text-foreground tabular-nums">{formatPKR(total)}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead>Paid by</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No purchases in this range.</TableCell></TableRow>
              )}
              {filtered.map((r: any) => {
                const items = r.purchase_items ?? [];
                const names = items.map((it: any) => it.products?.name).filter(Boolean).join(", ");
                const rowGrams = items.reduce((g: number, it: any) => g + Number(it.quantity_g || 0), 0);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{displayDate(r.purchase_date)}</TableCell>
                    <TableCell>{r.suppliers?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="text-sm">{items.length} item{items.length === 1 ? "" : "s"}</div>
                      {names && <div className="text-xs text-muted-foreground line-clamp-1">{names}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatKgG(rowGrams)}</TableCell>
                    <TableCell className="text-sm">
                      {r.paid_by === "cash" ? "Cash" : r.paid_by === "credit" ? <span className="text-warning">Credit</span> : (r.banks?.bank_name ?? "Bank")}
                      {r.paid_by === "bank" && r.banks?.account_title && <div className="text-xs text-muted-foreground">{r.banks.account_title}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatMoney(r.total_amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setViewId(r.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Share on WhatsApp" onClick={() => shareOnWhatsApp(buildPurchaseMessage(r))}>
                        <WhatsAppIcon className="h-4 w-4 text-success" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" asChild title="Edit">
                            <Link to="/purchases/$id/edit" params={{ id: r.id }}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => confirm("Delete this purchase?") && del.mutate(r.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Purchase details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Date: </span>{displayDate(viewing.purchase_date)}</div>
                <div><span className="text-muted-foreground">Supplier: </span>{viewing.suppliers?.name ?? "—"}</div>
                <div><span className="text-muted-foreground">Paid by: </span>{viewing.paid_by === "cash" ? "Cash" : viewing.paid_by === "credit" ? "Credit (unpaid)" : (viewing.banks?.bank_name ?? "—")}</div>
              </div>

              {viewing.notes && <div className="text-sm"><span className="text-muted-foreground">Notes: </span>{viewing.notes}</div>}
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate/kg</TableHead>
                  <TableHead className="text-right">Line</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(viewing.purchase_items ?? []).map((it: any) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.products?.name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatKgG(it.quantity_g)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRate(it.rate)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatRate(it.line_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between text-sm">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => shareOnWhatsApp(buildPurchaseMessage(viewing))}>
                  <WhatsAppIcon className="h-4 w-4 text-success" /> Share on WhatsApp
                </Button>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Weight: <span className="tabular-nums text-foreground">{formatKg((viewing.purchase_items ?? []).reduce((g: number, it: any) => g + Number(it.quantity_g || 0), 0))}</span></div>
                  <div className="font-semibold">Total: <span className="tabular-nums">{formatPKR(viewing.total_amount)}</span></div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
