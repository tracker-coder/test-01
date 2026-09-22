import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useBanks, useLastRates, useProducts, useSuppliers } from "@/hooks/use-master-data";
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

export function PurchaseFormPage({ initial }: { initial?: any }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const suppliers = useSuppliers();
  const products = useProducts();
  const banks = useBanks();
  const lastRates = useLastRates("supplier");

  const [purchase_date, setDate] = useState(
    initial?.purchase_date ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [supplier_id, setSupplier] = useState(initial?.supplier_id ?? "");
  const [paid_by, setPaidBy] = useState<"cash" | "bank" | "credit">(initial?.paid_by ?? "cash");
  const [bank_id, setBank] = useState(initial?.bank_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<LineItem[]>(itemsFromRows(initial?.purchase_items));

  const isEdit = !!initial?.id;
  const total = itemsTotal(items, false);
  const weight = itemsWeight(items, false);

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
        const { error: eu } = await (supabase as any)
          .from("purchases").update(payload).eq("id", parentId);
        if (eu) throw eu;
        const { error: ed } = await (supabase as any)
          .from("purchase_items").delete().eq("purchase_id", parentId);
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
      toast.success(isEdit ? "Purchase updated" : "Purchase saved");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
      qc.invalidateQueries({ queryKey: ["bank_balances"] });
      qc.invalidateQueries({ queryKey: ["supplier-statement"] });
      qc.invalidateQueries({ queryKey: ["product_party_rates"] });
      navigate({ to: "/purchases" });
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  return (
    <InvoiceFormShell
      backTo="/purchases"
      backLabel="Purchases"
      title={isEdit ? "Edit purchase" : "New purchase"}
      description="Totals are calculated from quantity × rate as you type."
      saveLabel={isEdit ? "Update purchase" : "Save purchase"}
      saving={save.isPending}
      total={total}
      totalLabel="Total"
      onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      summary={
        <>
          <SummaryRow label="Items" value={String(items.filter((i) => i.product_id).length)} />
          <SummaryRow label="Weight" value={formatKg(weight) || "0 kg"} />
          <SummaryRow label="Total" value={total} strong />
        </>
      }
    >
      <FormSection title="Purchase details" description="Who you bought from and how it was paid.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="purchase-date">Date</Label>
            <Input
              id="purchase-date" type="date" required
              value={purchase_date} onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Supplier *</Label>
            <Select value={supplier_id} onValueChange={setSupplier}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {(suppliers.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
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
                  {(banks.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bank_name} — {b.account_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title="Items" description="Each line is priced as quantity × rate per kg.">
        <InvoiceItemsTable
          items={items}
          onChange={setItems}
          products={products.data ?? []}
          lastRates={lastRates.data ?? {}}
          partyId={supplier_id}
        />
      </FormSection>

      <FormSection title="Notes">
        <Textarea
          rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything worth recording against this purchase"
        />
      </FormSection>
    </InvoiceFormShell>
  );
}
