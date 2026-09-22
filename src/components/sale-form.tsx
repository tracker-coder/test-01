import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useBanks, useCustomers, useLastRates, useProducts } from "@/hooks/use-master-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { InvoiceItemsTable } from "@/components/invoice-items-table";
import { FormSection, InvoiceFormShell, SummaryRow } from "@/components/invoice-page";
import { formatKg } from "@/lib/format";
import {
  itemsFromRows, itemsTotal, itemsWeight, validateItems, type LineItem,
} from "@/lib/invoice-items";

export function SaleFormPage({ initial }: { initial?: any }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
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
  const [shipping, setShipping] = useState(
    initial?.shipping_charges ? String(initial.shipping_charges) : "",
  );
  const [loading, setLoading] = useState(
    initial?.loading_charges ? String(initial.loading_charges) : "",
  );

  const isEdit = !!initial?.id;
  const total = itemsTotal(items, true);
  const sellWeight = itemsWeight(items, true);
  const shippingNum = Math.max(Number(shipping) || 0, 0);
  const loadingNum = Math.max(Number(loading) || 0, 0);
  const netTotal = total - shippingNum - loadingNum;

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
            sale_date, customer_id, paid_by,
            bank_id: paid_by === "bank" ? bank_id : null,
            reference_no: reference_no || null,
            notes: notes || null,
            shipping_charges: shippingNum,
            loading_charges: loadingNum,
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
            sale_date, customer_id, paid_by,
            bank_id: paid_by === "bank" ? bank_id : null,
            reference_no: reference_no || null,
            notes: notes || null,
            shipping_charges: shippingNum,
            loading_charges: loadingNum,
            created_by: u.user?.id,
            total_amount: 0,
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
      toast.success(isEdit ? "Sale updated" : "Sale saved");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["banks"] });
      qc.invalidateQueries({ queryKey: ["product_party_rates"] });
      navigate({ to: "/sales" });
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  return (
    <InvoiceFormShell
      backTo="/sales"
      backLabel="Sales"
      title={isEdit ? "Edit sale" : "New sale"}
      description="Totals are calculated from quantity × rate as you type."
      saveLabel={isEdit ? "Update sale" : "Save sale"}
      saving={save.isPending}
      total={netTotal}
      onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      summary={
        <>
          <SummaryRow label="Items" value={String(items.filter((i) => i.product_id).length)} />
          <SummaryRow label="Sell weight" value={formatKg(sellWeight) || "0 kg"} />
          <SummaryRow label="Items total" value={total} />
          <SummaryRow label="Shipping" value={shippingNum} negative />
          <SummaryRow label="Loading / unloading" value={loadingNum} negative />
          <SummaryRow label="Net total" value={netTotal} strong />
        </>
      }
    >
      <FormSection title="Invoice details" description="Who this sale is for and how it was paid.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sale-date">Date</Label>
            <Input
              id="sale-date" type="date" required
              value={sale_date} onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Customer *</Label>
            <Select value={customer_id} onValueChange={setCustomer}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {(customers.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Paid by *</Label>
            <Select value={paid_by} onValueChange={(v) => setPaidBy(v as typeof paid_by)}>
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
                  {(banks.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bank_name} — {b.account_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sale-ref">Reference no.</Label>
            <Input
              id="sale-ref" value={reference_no}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Invoice / receipt no."
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Items"
        description="Cutting is subtracted from the quantity before the line is priced."
      >
        <InvoiceItemsTable
          items={items}
          onChange={setItems}
          products={products.data ?? []}
          lastRates={lastRates.data ?? {}}
          partyId={customer_id}
          enableCutting
        />
      </FormSection>

      <FormSection title="Charges & notes" description="Deducted from the invoice total.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sale-shipping">Shipping charges</Label>
            <Input
              id="sale-shipping" type="number" min="0" step="0.01" inputMode="decimal"
              value={shipping} onChange={(e) => setShipping(e.target.value)}
              placeholder="0" className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sale-loading">Loading / unloading charges</Label>
            <Input
              id="sale-loading" type="number" min="0" step="0.01" inputMode="decimal"
              value={loading} onChange={(e) => setLoading(e.target.value)}
              placeholder="0" className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sale-notes">Notes</Label>
            <Textarea
              id="sale-notes" rows={3} value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth recording against this invoice"
            />
          </div>
        </div>
      </FormSection>
    </InvoiceFormShell>
  );
}
