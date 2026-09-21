import { createFileRoute } from "@tanstack/react-router";
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
import { InvoiceItemsEditor, newEmptyItem, validateItems, type LineItem } from "@/components/invoice-items-editor";
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
  const [editRow, setEditRow] = useState<any | null>(null);
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
            <FormDialog
              trigger={<Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> New purchase</Button>}
              title="New purchase"
              description="Add one or more products. Total is auto-calculated from quantity × rate."
              size="lg"
            >
              {(close) => <PurchaseForm onDone={close} />}
            </FormDialog>
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
                          <Button variant="ghost" size="icon" onClick={() => setEditRow(r)} title="Edit">
                            <Pencil className="h-4 w-4" />
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

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit purchase</DialogTitle>
          </DialogHeader>
          {editRow && <PurchaseForm initial={editRow} onDone={() => setEditRow(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function itemsFromRows(rows: any[] | undefined): LineItem[] {
  if (!rows || rows.length === 0) return [newEmptyItem()];
  return rows.map((r) => {
    const { kg, g } = gramsToKgGram(r.quantity_g);
    return { id: crypto.randomUUID(), product_id: r.product_id, kg: String(kg), g: String(g), rate: String(r.rate), rateTouched: true };
  });
}

function PurchaseForm({ onDone, initial }: { onDone: () => void; initial?: any }) {
  const qc = useQueryClient();
  const suppliers = useSuppliers();
  const products = useProducts();
  const banks = useBanks();
  const lastRates = useLastRates("supplier");
  const [purchase_date, setDate] = useState(initial?.purchase_date ?? format(new Date(), "yyyy-MM-dd"));
  const [supplier_id, setSupplier] = useState(initial?.supplier_id ?? "");
  const [paid_by, setPaidBy] = useState<"cash" | "bank" | "credit">(initial?.paid_by ?? "cash");
  const [bank_id, setBank] = useState(initial?.bank_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<LineItem[]>(itemsFromRows(initial?.purchase_items));

  const save = useMutation({
    mutationFn: async () => {
      if (!supplier_id) throw new Error("Select a supplier");
      if (paid_by === "bank" && !bank_id) throw new Error("Select a bank");
      const v = validateItems(items);
      if (!v.ok || !v.prepared) throw new Error(v.message);
      const payload: any = {
        purchase_date, supplier_id, paid_by,
        bank_id: paid_by === "bank" ? bank_id : null,
        notes: notes || null,
      };
      let parentId: string;
      if (initial?.id) {
        parentId = initial.id;
        const { error: eu } = await (supabase as any).from("purchases").update(payload).eq("id", parentId);
        if (eu) throw eu;
        const { error: ed } = await (supabase as any).from("purchase_items").delete().eq("purchase_id", parentId);
        if (ed) throw ed;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data: parent, error } = await (supabase as any)
          .from("purchases")
          .insert({ ...payload, created_by: u.user?.id, total_amount: 0 })
          .select("id").single();
        if (error) throw error;
        parentId = parent.id;
      }
      const rows = v.prepared.map((it) => ({ ...it, purchase_id: parentId }));
      const { error: e2 } = await (supabase as any).from("purchase_items").insert(rows);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Purchase updated" : "Purchase saved");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
      qc.invalidateQueries({ queryKey: ["bank_balances"] });
      qc.invalidateQueries({ queryKey: ["supplier-statement"] });
      qc.invalidateQueries({ queryKey: ["product_party_rates"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={purchase_date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Supplier *</Label>
          <Select value={supplier_id} onValueChange={setSupplier}>
            <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
            <SelectContent>
              {(suppliers.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Paid by *</Label>
          <Select value={paid_by} onValueChange={(v) => setPaidBy(v as "cash" | "bank" | "credit")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="credit">Credit (pay supplier later)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {paid_by === "bank" && (
          <div className="space-y-1.5">
            <Label>Bank (paid from) *</Label>
            <Select value={bank_id} onValueChange={setBank}>
              <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
              <SelectContent>
                {(banks.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <InvoiceItemsEditor
        items={items}
        onChange={setItems}
        products={products.data ?? []}
        lastRates={lastRates.data ?? {}}
        partyId={supplier_id}
      />

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : (initial?.id ? "Update purchase" : "Save purchase")}</Button>
      </div>
    </form>
  );
}

