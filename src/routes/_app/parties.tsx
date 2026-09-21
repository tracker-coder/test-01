import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatPKR, formatMoney } from "@/lib/format";
import { displayDate } from "@/lib/date-range";
import { useSuppliers, useCustomers, useBanks } from "@/hooks/use-master-data";
import { useIsAdmin } from "@/hooks/use-role";
import { Plus, Trash2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { shareOnWhatsApp } from "@/lib/whatsapp";
import { KPICard } from "@/components/kpi-card";

export const Route = createFileRoute("/_app/parties")({
  head: () => ({ meta: [{ title: "Party Statements — GUL Paper" }] }),
  component: PartiesPage,
});

type PartyType = "supplier" | "customer";

interface LedgerRow {
  date: string;
  kind: string;
  ref: string;
  description: string;
  debit: number;
  credit: number;
  paymentId?: string;
}


function PartiesPage() {
  const [partyType, setPartyType] = useState<PartyType>("supplier");
  const [partyId, setPartyId] = useState<string>("");
  const dr = useDateRange("year");

  const suppliers = useSuppliers();
  const customers = useCustomers();
  const list = partyType === "supplier" ? (suppliers.data ?? []) : (customers.data ?? []);
  const currentParty = list.find((p) => p.id === partyId);

  return (
    <div>
      <PageHeader
        title="Party Statements"
        description="Running balance for each supplier and customer, including credit invoices and payments."
      />

      <div className="mb-4 rounded-xl border bg-card p-3 flex flex-wrap items-end gap-3">
        <Tabs value={partyType} onValueChange={(v) => { setPartyType(v as PartyType); setPartyId(""); }}>
          <TabsList>
            <TabsTrigger value="supplier">Suppliers</TabsTrigger>
            <TabsTrigger value="customer">Customers</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="min-w-[220px] space-y-1.5">
          <Label className="text-xs">{partyType === "supplier" ? "Supplier" : "Customer"}</Label>
          <Select value={partyId} onValueChange={setPartyId}>
            <SelectTrigger><SelectValue placeholder={`Select ${partyType}`} /></SelectTrigger>
            <SelectContent>
              {list.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DateRangeSelect {...dr} />
      </div>

      {partyId ? (
        <PartyStatement
          partyType={partyType}
          partyId={partyId}
          partyName={currentParty?.name ?? ""}
          partyPhone={(currentParty as any)?.phone ?? null}
          from={format(dr.range.from, "yyyy-MM-dd")}
          to={format(dr.range.to, "yyyy-MM-dd")}
        />
      ) : (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Choose a {partyType} to view the statement.
        </div>
      )}
    </div>
  );
}

function PartyStatement({ partyType, partyId, partyName, partyPhone, from, to }: {
  partyType: PartyType; partyId: string; partyName: string; partyPhone: string | null; from: string; to: string;
}) {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();

  const { data, isLoading } = useQuery({
    queryKey: [`${partyType}-statement`, partyId, from, to],
    queryFn: async () => {
      const [opening, invoices, payments] = await Promise.all([
        (supabase as any).from("party_openings").select("*").eq("party_type", partyType).eq("party_id", partyId).maybeSingle(),
        partyType === "supplier"
          ? (supabase as any).from("purchases").select("id, purchase_date, total_amount, paid_by, notes").eq("supplier_id", partyId).order("purchase_date")
          : (supabase as any).from("sales").select("id, sale_date, total_amount, paid_by, reference_no, notes").eq("customer_id", partyId).order("sale_date"),
        (supabase as any).from("party_payments").select("id, tx_date, amount, method, note, bank_id, banks(bank_name)").eq("party_type", partyType).eq("party_id", partyId).order("tx_date"),
      ]);
      if (opening.error) throw opening.error;
      if (invoices.error) throw invoices.error;
      if (payments.error) throw payments.error;
      return {
        opening: opening.data as any | null,
        invoices: (invoices.data ?? []) as any[],
        payments: (payments.data ?? []) as any[],
      };
    },
  });

  const rows: LedgerRow[] = useMemo(() => {
    if (!data) return [];
    const out: LedgerRow[] = [];
    // Opening
    if (data.opening) {
      const amt = Number(data.opening.amount ?? 0);
      const isDebit =
        (partyType === "supplier" && data.opening.direction === "payable") ||
        (partyType === "customer" && data.opening.direction === "receivable");
      out.push({
        date: data.opening.as_of,
        kind: "Opening",
        ref: "—",
        description: `Opening balance (${data.opening.direction})`,
        debit: isDebit ? amt : 0,
        credit: isDebit ? 0 : amt,
      });
    }
    // Invoices
    for (const inv of data.invoices) {
      const date = partyType === "supplier" ? inv.purchase_date : inv.sale_date;
      const total = Number(inv.total_amount ?? 0);
      out.push({
        date,
        kind: partyType === "supplier" ? "Purchase" : "Sale",
        ref: inv.reference_no ?? inv.id.slice(0, 8),
        description: `${partyType === "supplier" ? "Purchase" : "Sale"}${inv.paid_by === "credit" ? " (credit)" : ` (${inv.paid_by})`}`,
        debit: total,
        credit: 0,
      });
      // Immediate payment for non-credit invoices to keep running balance correct
      if (inv.paid_by !== "credit") {
        out.push({
          date,
          kind: "Settle",
          ref: inv.reference_no ?? inv.id.slice(0, 8),
          description: `Paid via ${inv.paid_by} on invoice`,
          debit: 0,
          credit: total,
        });
      }
    }
    // Payments
    for (const p of data.payments) {
      out.push({
        date: p.tx_date,
        kind: "Payment",
        ref: p.id.slice(0, 8),
        description: `${partyType === "supplier" ? "Payment made" : "Payment received"} (${p.method}${p.banks?.bank_name ? ` — ${p.banks.bank_name}` : ""})${p.note ? ` — ${p.note}` : ""}`,
        debit: 0,
        credit: Number(p.amount ?? 0),
        paymentId: p.id,
      });
    }

    // Sort by date then by kind (opening first)
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [data, partyType]);

  // Filter to date range, but keep opening running from beginning
  const inRange = rows.filter((r) => r.date >= from && r.date <= to);
  const openingCarry = rows
    .filter((r) => r.date < from)
    .reduce((s, r) => s + r.debit - r.credit, 0);

  let running = openingCarry;
  const withRunning = inRange.map((r) => {
    running += r.debit - r.credit;
    return { ...r, running };
  });

  const totalDebit = inRange.reduce((s, r) => s + r.debit, 0);
  const totalCredit = inRange.reduce((s, r) => s + r.credit, 0);
  const closing = openingCarry + totalDebit - totalCredit;

  const balanceLabel = partyType === "supplier"
    ? (closing >= 0 ? "We owe supplier" : "Advance with supplier")
    : (closing >= 0 ? "Customer owes us" : "Advance from customer");

  const shareMsg = [
    `*${partyType === "supplier" ? "Supplier" : "Customer"} Statement — GUL Paper*`,
    `${partyName}`,
    `Period: ${displayDate(from)} — ${displayDate(to)}`,
    ``,
    `Opening: ${formatPKR(openingCarry)}`,
    `${partyType === "supplier" ? "Purchases + charges" : "Sales + charges"}: ${formatPKR(totalDebit)}`,
    `Payments/settlements: ${formatPKR(totalCredit)}`,
    ``,
    `*${balanceLabel}: ${formatPKR(Math.abs(closing))}*`,
  ].join("\n");

  const delPayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("party_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment deleted");
      qc.invalidateQueries({ queryKey: [`${partyType}-statement`] });
      qc.invalidateQueries({ queryKey: ["bank_balances"] });
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
    },
    onError: (e: any) => toast.error(e.message || "Delete failed"),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <KPICard label="Opening" value={openingCarry} />
        <KPICard label={partyType === "supplier" ? "Purchases" : "Sales"} value={totalDebit} tone="destructive" />
        <KPICard label="Payments / settled" value={totalCredit} tone="success" />
        <KPICard label={balanceLabel} value={Math.abs(closing)} tone={closing >= 0 ? "warning" : "success"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">{partyName}</div>
        <div className="flex gap-2">
          <FormDialog
            trigger={<Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Record payment</Button>}
            title={partyType === "supplier" ? "Pay supplier" : "Receive customer payment"}
          >
            {(close) => <PaymentForm partyType={partyType} partyId={partyId} onDone={close} />}
          </FormDialog>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => shareOnWhatsApp(shareMsg, partyPhone ?? undefined)}>
            <WhatsAppIcon className="h-4 w-4 text-success" /> Share statement
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {openingCarry !== 0 && (
              <TableRow className="bg-muted/40">
                <TableCell>{displayDate(from)}</TableCell>
                <TableCell className="text-muted-foreground italic">B/F</TableCell>
                <TableCell className="text-muted-foreground italic">Balance brought forward</TableCell>
                <TableCell className="text-right tabular-nums">{openingCarry > 0 ? formatMoney(openingCarry) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{openingCarry < 0 ? formatMoney(-openingCarry) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatMoney(openingCarry)}</TableCell>
                <TableCell />
              </TableRow>
            )}
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {!isLoading && withRunning.length === 0 && openingCarry === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No transactions in this range.</TableCell></TableRow>
            )}
            {withRunning.map((r, i) => {
              const paymentId = r.paymentId ?? null;

              return (
                <TableRow key={`${r.date}-${i}`}>
                  <TableCell className="whitespace-nowrap">{displayDate(r.date)}</TableCell>
                  <TableCell className="text-sm">{r.kind}</TableCell>
                  <TableCell className="text-sm">{r.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.debit > 0 ? formatMoney(r.debit) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.credit > 0 ? formatMoney(r.credit) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatMoney(r.running)}</TableCell>
                  <TableCell className="text-right">
                    {paymentId && isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => confirm("Delete this payment?") && delPayment.mutate(paymentId)}>
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
  );
}

function PaymentForm({ partyType, partyId, onDone }: { partyType: PartyType; partyId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const banks = useBanks();
  const [tx_date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [bank_id, setBank] = useState("");
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!(amt > 0)) throw new Error("Enter a valid amount");
      if (method === "bank" && !bank_id) throw new Error("Select a bank");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("party_payments").insert({
        party_type: partyType, party_id: partyId, tx_date, amount: amt, method,
        bank_id: method === "bank" ? bank_id : null,
        note: note || null, created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: [`${partyType}-statement`] });
      qc.invalidateQueries({ queryKey: ["bank_balances"] });
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" required value={tx_date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Amount (Rs) *</Label>
          <Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Method *</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as "cash" | "bank")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {method === "bank" && (
          <div className="space-y-1.5">
            <Label>Bank *</Label>
            <Select value={bank_id} onValueChange={setBank}>
              <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
              <SelectContent>
                {(banks.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Note</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save payment"}</Button>
      </div>
    </form>
  );
}
