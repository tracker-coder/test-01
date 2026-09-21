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
import { formatPKR, formatMoney, formatRate, formatKgG, formatKg, gramsToKgGram, kgGramToGrams, totalFromRatePerKg } from "@/lib/format";
import { displayDate } from "@/lib/date-range";
import { useCustomers, useProducts, useBanks, useLastRates } from "@/hooks/use-master-data";
import { useIsAdmin } from "@/hooks/use-role";
import { InvoiceItemsEditor, newEmptyItem, validateItems, type LineItem } from "@/components/invoice-items-editor";
import { Plus, Trash2, Search, Eye, Pencil, Receipt, Scale, Wallet, TrendingUp } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { shareOnWhatsApp } from "@/lib/whatsapp";
import { KPICard } from "@/components/kpi-card";

function buildSaleMessage(r: any) {
  const items = (r.sale_items ?? [])
    .map((it: any) => {
      const cut = Number(it.cutting_g ?? 0);
      const sell = Math.max(Number(it.quantity_g) - cut, 0);
      const cutTxt = cut > 0 ? ` (cut ${formatKgG(cut)}, sell ${formatKgG(sell)})` : "";
      return `• ${it.products?.name ?? "—"} — ${formatKgG(it.quantity_g)}${cutTxt} @ ${formatPKR(it.rate)}/kg = ${formatPKR(it.line_total)}`;
    })
    .join("\n");
  const paid = r.paid_by === "cash" ? "Cash" : r.paid_by === "credit" ? "Credit (unpaid)" : (r.banks?.bank_name ?? "Bank");
  const shipping = Number(r.shipping_charges ?? 0);
  const loading = Number(r.loading_charges ?? 0);
  const itemsTotal = (r.sale_items ?? []).reduce((s: number, it: any) => s + Number(it.line_total || 0), 0);
  const hasCharges = shipping > 0 || loading > 0;
  return [
    `*Sale Invoice — GUL Paper*`,
    `Date: ${displayDate(r.sale_date)}`,
    `Customer: ${r.customers?.name ?? "—"}`,
    `Paid by: ${paid}`,
    r.reference_no ? `Ref: ${r.reference_no}` : "",
    ``,
    items || "(no items)",
    ``,
    hasCharges ? `Items total: ${formatPKR(itemsTotal)}` : "",
    shipping > 0 ? `Shipping: -${formatPKR(shipping)}` : "",
    loading > 0 ? `Loading/unloading: -${formatPKR(loading)}` : "",
    `*${hasCharges ? "Net total" : "Total"}: ${formatPKR(r.total_amount)}*`,
    r.notes ? `\nNotes: ${r.notes}` : "",
  ].filter(Boolean).join("\n");
}


export const Route = createFileRoute("/_app/sales")({
  head: () => ({ meta: [{ title: "Sales — GUL Paper" }] }),
  component: SalesPage,
});

function SalesPage() {
  const dr = useDateRange("month");
  const [search, setSearch] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<any | null>(null);
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();

  const from = format(dr.range.from, "yyyy-MM-dd");
  const to = format(dr.range.to, "yyyy-MM-dd");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["sales", from, to],
    queryFn: async () => {
      const [sales, services] = await Promise.all([
        (supabase as any)
          .from("sales")
          .select("*, customers(name), banks(bank_name,account_title), sale_items(id, product_id, quantity_g, cutting_g, rate, line_total, products(name))")
          .gte("sale_date", from).lte("sale_date", to)
          .order("sale_date", { ascending: false })
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("service_sales")
          .select("*, customers(name), banks(bank_name,account_title)")
          .gte("sale_date", from).lte("sale_date", to)
          .order("sale_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      if (sales.error) throw sales.error;
      if (services.error) throw services.error;
      const merged: any[] = [
        ...(sales.data ?? []).map((r: any) => ({ ...r, __kind: "product", total_amount: Number(r.total_amount) })),
        ...(services.data ?? []).map((r: any) => ({ ...r, __kind: "service", total_amount: Number(r.amount) })),
      ];
      merged.sort((a, b) => (a.sale_date < b.sale_date ? 1 : a.sale_date > b.sale_date ? -1 : (a.created_at < b.created_at ? 1 : -1)));
      return merged;
    },
  });

  const total = (rows ?? []).reduce((s, r: any) => s + Number(r.total_amount), 0);
  const productRows = (rows ?? []).filter((r: any) => r.__kind === "product");
  const serviceTotal = (rows ?? []).filter((r: any) => r.__kind === "service").reduce((s, r: any) => s + Number(r.total_amount), 0);
  const totalSellGrams = productRows.reduce(
    (s, r: any) => s + (r.sale_items ?? []).reduce((g: number, it: any) => g + Math.max(Number(it.quantity_g || 0) - Number(it.cutting_g || 0), 0), 0),
    0,
  );
  const productAmount = productRows.reduce((s, r: any) => s + Number(r.total_amount), 0);
  const avgRatePerKg = totalSellGrams > 0 ? (productAmount * 1000) / totalSellGrams : 0;
  const filtered = (rows ?? []).filter((r: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if (r.customers?.name?.toLowerCase().includes(q)) return true;
    if (r.banks?.bank_name?.toLowerCase().includes(q)) return true;
    if ((r.reference_no ?? "").toLowerCase().includes(q)) return true;
    if ((r.notes ?? r.note ?? "").toLowerCase().includes(q)) return true;
    if (r.__kind === "service" && (r.service_name ?? "").toLowerCase().includes(q)) return true;
    return (r.sale_items ?? []).some((it: any) => it.products?.name?.toLowerCase().includes(q));
  });

  const del = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: string }) => {
      const table = kind === "service" ? "service_sales" : "sales";
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["banks"] });
    },
    onError: (e: any) => toast.error(e.message || "Delete failed"),
  });

  const viewing = (rows ?? []).find((r: any) => r.id === viewId);

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Product invoices and service revenue (e.g. Weight Scale)."
        actions={
          <>
            <DateRangeSelect {...dr} />
            <FormDialog
              trigger={<Button size="sm" variant="outline" className="gap-1"><Plus className="h-4 w-4" /> Service revenue</Button>}
              title="New service revenue"
              description="Non-inventory income (e.g. Weight Scale). Adds directly to profit."
            >
              {(close) => <ServiceSaleForm onDone={close} />}
            </FormDialog>
            <FormDialog
              trigger={<Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> New sale</Button>}
              title="New sale"
              description="Add one or more products. Total is auto-calculated from quantity × rate."
              size="lg"
            >
              {(close) => <SaleForm onDone={close} />}
            </FormDialog>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KPICard label="Invoices" value={(rows ?? []).length} currency={false} icon={<Receipt className="h-4 w-4" />} />
        <KPICard label="Sell weight" value={formatKg(totalSellGrams)} currency={false} icon={<Scale className="h-4 w-4" />} />
        <KPICard label="Product sales" value={productAmount} icon={<Wallet className="h-4 w-4" />} />
        <KPICard label="Service revenue" value={serviceTotal} icon={<Wallet className="h-4 w-4" />} />
        <KPICard label="Avg rate / kg" value={avgRatePerKg > 0 ? formatRate(avgRatePerKg) : "—"} currency={false} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border bg-card">

        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customer, product, bank, reference…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-72" />
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{filtered.length}</span> invoices • Total <span className="font-semibold text-foreground tabular-nums">{formatPKR(total)}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No sales in this range.</TableCell></TableRow>
              )}
              {filtered.map((r: any) => {
                const isService = r.__kind === "service";
                const items = r.sale_items ?? [];
                const names = items.map((it: any) => it.products?.name).filter(Boolean).join(", ");
                return (
                  <TableRow key={`${r.__kind}-${r.id}`}>
                    <TableCell className="whitespace-nowrap">{displayDate(r.sale_date)}</TableCell>
                    <TableCell>{r.customers?.name ?? (isService ? "—" : "—")}</TableCell>
                    <TableCell>
                      {isService ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">Service</span>
                          <span className="text-sm">{r.service_name}</span>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm">{items.length} item{items.length === 1 ? "" : "s"}</div>
                          {names && <div className="text-xs text-muted-foreground line-clamp-1">{names}</div>}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{r.paid_by === "cash" ? "Cash" : r.paid_by === "credit" ? <span className="text-warning">Credit</span> : (r.banks?.bank_name ?? "—")}</div>
                      {r.paid_by === "bank" && <div className="text-xs text-muted-foreground">{r.banks?.account_title}</div>}
                    </TableCell>

                    <TableCell className="text-right tabular-nums font-medium">{formatMoney(r.total_amount)}</TableCell>
                    <TableCell className="text-right">
                      {!isService && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => setViewId(r.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Share on WhatsApp" onClick={() => shareOnWhatsApp(buildSaleMessage(r))}>
                            <WhatsAppIcon className="h-4 w-4 text-success" />
                          </Button>
                        </>
                      )}
                      {isAdmin && !isService && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => setEditRow(r)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {isAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => confirm(isService ? "Delete this service entry?" : "Delete this sale?") && del.mutate({ id: r.id, kind: r.__kind })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Sale details</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Date: </span>{displayDate(viewing.sale_date)}</div>
                <div><span className="text-muted-foreground">Customer: </span>{viewing.customers?.name ?? "—"}</div>
                <div><span className="text-muted-foreground">Paid by: </span>{viewing.paid_by === "cash" ? "Cash" : viewing.paid_by === "credit" ? "Credit (unpaid)" : (viewing.banks?.bank_name ?? "—")}</div>
                {viewing.reference_no && <div><span className="text-muted-foreground">Ref: </span>{viewing.reference_no}</div>}
              </div>
              {viewing.notes && <div className="text-sm"><span className="text-muted-foreground">Notes: </span>{viewing.notes}</div>}
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cutting</TableHead>
                  <TableHead className="text-right">Sell qty</TableHead>
                  <TableHead className="text-right">Rate/kg</TableHead>
                  <TableHead className="text-right">Line</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(viewing.sale_items ?? []).map((it: any) => {
                    const cut = Number(it.cutting_g ?? 0);
                    const sell = Math.max(Number(it.quantity_g) - cut, 0);
                    return (
                      <TableRow key={it.id}>
                        <TableCell>{it.products?.name ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatKgG(it.quantity_g)}</TableCell>
                        <TableCell className="text-right tabular-nums">{cut > 0 ? formatKgG(cut) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatKgG(sell)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatRate(it.rate)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatRate(it.line_total)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-start justify-between gap-3 text-sm">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => shareOnWhatsApp(buildSaleMessage(viewing))}>
                  <WhatsAppIcon className="h-4 w-4 text-success" /> Share on WhatsApp
                </Button>
                <div className="space-y-1 text-right">
                  {(Number(viewing.shipping_charges ?? 0) > 0 || Number(viewing.loading_charges ?? 0) > 0) && (
                    <>
                      <div className="text-muted-foreground">
                        Items total: <span className="tabular-nums">{formatPKR((viewing.sale_items ?? []).reduce((s: number, it: any) => s + Number(it.line_total || 0), 0))}</span>
                      </div>
                      {Number(viewing.shipping_charges ?? 0) > 0 && (
                        <div className="text-muted-foreground">Shipping: <span className="tabular-nums">−{formatPKR(viewing.shipping_charges)}</span></div>
                      )}
                      {Number(viewing.loading_charges ?? 0) > 0 && (
                        <div className="text-muted-foreground">Loading/unloading: <span className="tabular-nums">−{formatPKR(viewing.loading_charges)}</span></div>
                      )}
                    </>
                  )}
                  <div className="font-semibold">Net total: <span className="tabular-nums">{formatPKR(viewing.total_amount)}</span></div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Edit sale</DialogTitle></DialogHeader>
          {editRow && <SaleForm initial={editRow} onDone={() => setEditRow(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function itemsFromRows(rows: any[] | undefined): LineItem[] {
  if (!rows || rows.length === 0) return [newEmptyItem()];
  return rows.map((r) => {
    const { kg, g } = gramsToKgGram(r.quantity_g);
    const cuttingKg = Math.floor(Number(r.cutting_g ?? 0) / 1000);
    return { id: crypto.randomUUID(), product_id: r.product_id, kg: String(kg), g: String(g), cutting_kg: cuttingKg ? String(cuttingKg) : "", rate: String(r.rate), rateTouched: true };
  });
}

function SaleForm({ onDone, initial }: { onDone: () => void; initial?: any }) {
  const qc = useQueryClient();
  const customers = useCustomers();
  const products = useProducts();
  const banks = useBanks();
  const lastRates = useLastRates("customer");
  const [sale_date, setDate] = useState(initial?.sale_date ?? format(new Date(), "yyyy-MM-dd"));
  const [customer_id, setCustomer] = useState(initial?.customer_id ?? "");
  const [paid_by, setPaidBy] = useState<"cash" | "bank" | "credit">(initial?.paid_by ?? "bank");
  const [bank_id, setBank] = useState(initial?.bank_id ?? "");
  const [reference_no, setRef] = useState(initial?.reference_no ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<LineItem[]>(itemsFromRows(initial?.sale_items));
  const [shipping, setShipping] = useState(initial?.shipping_charges ? String(initial.shipping_charges) : "");
  const [loading, setLoading] = useState(initial?.loading_charges ? String(initial.loading_charges) : "");

  const itemsTotal = items.reduce((s, it) => {
    const grams = kgGramToGrams(it.kg, it.g);
    const cut = kgGramToGrams(it.cutting_kg ?? "0", "0");
    return s + totalFromRatePerKg(it.rate, Math.max(grams - cut, 0));
  }, 0);
  const shippingNum = Math.max(Number(shipping) || 0, 0);
  const loadingNum = Math.max(Number(loading) || 0, 0);
  const netTotal = itemsTotal - shippingNum - loadingNum;

  const save = useMutation({
    mutationFn: async () => {
      if (paid_by === "bank" && !bank_id) throw new Error("Select a bank");
      if (!customer_id) throw new Error("Select a customer");
      const v = validateItems(items, { withCutting: true });
      if (!v.ok || !v.prepared) throw new Error(v.message);
      let parentId: string;
      if (initial?.id) {
        parentId = initial.id;
        const { error: eu } = await (supabase as any)
          .from("sales")
          .update({
            sale_date, customer_id, paid_by, bank_id: paid_by === "bank" ? bank_id : null,
            reference_no: reference_no || null, notes: notes || null,
            shipping_charges: shippingNum, loading_charges: loadingNum,
          })
          .eq("id", parentId);
        if (eu) throw eu;
        const { error: ed } = await (supabase as any).from("sale_items").delete().eq("sale_id", parentId);
        if (ed) throw ed;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data: parent, error } = await (supabase as any)
          .from("sales")
          .insert({
            sale_date, customer_id, paid_by, bank_id: paid_by === "bank" ? bank_id : null,
            reference_no: reference_no || null,
            notes: notes || null,
            shipping_charges: shippingNum, loading_charges: loadingNum,
            created_by: u.user?.id, total_amount: 0,
          })
          .select("id").single();
        if (error) throw error;
        parentId = parent.id;
      }
      const rows = v.prepared.map((it) => ({ ...it, sale_id: parentId }));
      const { error: e2 } = await (supabase as any).from("sale_items").insert(rows);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Sale updated" : "Sale saved");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["banks"] });
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
          <Input type="date" required value={sale_date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Paid by *</Label>
          <Select value={paid_by} onValueChange={(v) => setPaidBy(v as "cash" | "bank" | "credit")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="credit">Credit (customer will pay later)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {paid_by === "bank" && (
          <div className="space-y-1.5">
            <Label>Bank (deposit to) *</Label>
            <Select value={bank_id} onValueChange={setBank}>
              <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
              <SelectContent>
                {(banks.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Customer *</Label>
          <Select value={customer_id} onValueChange={setCustomer}>
            <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>
              {(customers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Reference no.</Label>
          <Input value={reference_no} onChange={(e) => setRef(e.target.value)} placeholder="Invoice / receipt no." />
        </div>
      </div>

      <InvoiceItemsEditor
        items={items}
        onChange={setItems}
        products={products.data ?? []}
        lastRates={lastRates.data ?? {}}
        partyId={customer_id}
        enableCutting
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Shipping charges</Label>
          <Input type="number" min="0" step="0.01" inputMode="decimal" value={shipping}
            onChange={(e) => setShipping(e.target.value)} placeholder="0" className="tabular-nums" />
        </div>
        <div className="space-y-1.5">
          <Label>Loading/unloading charges</Label>
          <Input type="number" min="0" step="0.01" inputMode="decimal" value={loading}
            onChange={(e) => setLoading(e.target.value)} placeholder="0" className="tabular-nums" />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
        <div className="flex justify-between"><span className="text-muted-foreground">Items total</span><span className="tabular-nums">{formatPKR(itemsTotal)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span className="tabular-nums">−{formatPKR(shippingNum)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Loading/unloading</span><span className="tabular-nums">−{formatPKR(loadingNum)}</span></div>
        <div className="flex justify-between border-t pt-1 font-semibold"><span>Net total</span><span className="tabular-nums">{formatPKR(netTotal)}</span></div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t bg-background px-6 py-3">

        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : (initial?.id ? "Update sale" : "Save sale")}</Button>
      </div>
    </form>
  );
}

function ServiceSaleForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const customers = useCustomers();
  const banks = useBanks();
  const [sale_date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [paid_by, setPaidBy] = useState<"cash" | "bank">("cash");
  const [bank_id, setBank] = useState("");
  const [customer_id, setCustomer] = useState("");
  const [note, setNote] = useState("");
  const [service_name, setServiceName] = useState("Weight Scale");

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");
      if (paid_by === "bank" && !bank_id) throw new Error("Select a bank");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("service_sales").insert({
        sale_date,
        service_name: service_name.trim() || "Weight Scale",
        amount: amt,
        paid_by,
        bank_id: paid_by === "bank" ? bank_id : null,
        customer_id: customer_id || null,
        note: note || null,
        created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Service revenue saved");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["banks"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" required value={sale_date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Service</Label>
          <Input value={service_name} onChange={(e) => setServiceName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Amount (Rs) *</Label>
          <Input type="number" min="0" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Paid by *</Label>
          <Select value={paid_by} onValueChange={(v) => setPaidBy(v as "cash" | "bank")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {paid_by === "bank" && (
          <div className="space-y-1.5">
            <Label>Bank (deposit to) *</Label>
            <Select value={bank_id} onValueChange={setBank}>
              <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
              <SelectContent>
                {(banks.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Customer (optional)</Label>
          <Select value={customer_id || "none"} onValueChange={(v) => setCustomer(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {(customers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Note</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

