import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DateRangeSelect, useDateRange } from "@/components/date-range-select";
import { KPICard } from "@/components/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog } from "@/components/form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { z } from "zod";
import { format } from "date-fns";
import { formatPKR, formatMoney } from "@/lib/format";
import { displayDate } from "@/lib/date-range";
import { useIsAdmin } from "@/hooks/use-role";
import { Wallet, ArrowUp, ArrowDown, Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_app/cash-flow")({
  head: () => ({ meta: [{ title: "Cash Flow — GUL Paper" }] }),
  component: CashFlowPage,
});

function CashFlowPage() {
  const dr = useDateRange("month");
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const from = format(dr.range.from, "yyyy-MM-dd");
  const to = format(dr.range.to, "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["cash-flow", from, to],
    queryFn: async () => {
      const [ledger, bal, transfers, banks] = await Promise.all([
        (supabase as any).from("cash_ledger").select("*").gte("tx_date", from).lte("tx_date", to).order("tx_date", { ascending: false }).order("created_at", { ascending: false }),
        (supabase as any).from("cash_balance").select("current_cash").maybeSingle(),
        (supabase as any).from("cash_bank_transfers").select("*"),
        (supabase as any).from("banks").select("id,name").order("name"),
      ]);
      if (ledger.error) throw ledger.error;
      const transferMap = new Map<string, any>();
      for (const t of (transfers.data ?? [])) transferMap.set(t.id, t);
      return {
        rows: ledger.data as any[],
        current: Number(bal.data?.current_cash ?? 0),
        transferMap,
        banks: (banks.data ?? []) as { id: string; name: string }[],
      };
    },
  });

  const rows = data?.rows ?? [];
  const totalIn = rows.filter((r) => r.direction === "in").reduce((s, r) => s + Number(r.amount), 0);
  const totalOut = rows.filter((r) => r.direction === "out").reduce((s, r) => s + Number(r.amount), 0);
  const net = totalIn - totalOut;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["cash-flow"] });
    qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    qc.invalidateQueries({ queryKey: ["banks"] });
  };

  const deleteLedger = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("cash_ledger").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Entry deleted"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTransfer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("cash_bank_transfers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Bank transfer deleted"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Cash Flow"
        description="Automatic ledger of every cash-in and cash-out event."
        actions={
          <>
            <DateRangeSelect {...dr} />
            {isAdmin && (
              <FormDialog
                trigger={<Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Adjustment</Button>}
                title="Cash adjustment"
                description="Add or remove cash manually (e.g. opening balance, corrections)."
              >
                {(close) => <AdjustmentForm onDone={close} />}
              </FormDialog>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <KPICard label="Cash on hand" value={data?.current ?? 0} tone="success" icon={<Wallet className="h-4 w-4" />} />
        <KPICard label="Cash in (period)" value={totalIn} tone="success" icon={<ArrowUp className="h-4 w-4" />} />
        <KPICard label="Cash out (period)" value={totalOut} tone="destructive" icon={<ArrowDown className="h-4 w-4" />} />
        <KPICard label="Net (period)" value={net} tone={net >= 0 ? "success" : "destructive"} />
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
              {isAdmin && <TableHead className="text-right w-[120px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">No cash movements in this range.</TableCell></TableRow>
            )}
            {rows.map((r) => {
              const transfer = data?.transferMap.get(r.source_id);
              const isTransfer = !!transfer;
              const isPlainAdjustment = r.source_type === "adjustment" && !isTransfer;
              const canDelete = isAdmin && (isTransfer || isPlainAdjustment);
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{displayDate(r.tx_date)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {isTransfer ? "Bank transfer" : r.source_type}
                    </Badge>
                  </TableCell>
                  <TableCell><div className="text-sm">{r.note ?? "—"}</div></TableCell>
                  <TableCell className="text-right tabular-nums text-success">{r.direction === "in" ? formatMoney(r.amount) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">{r.direction === "out" ? formatMoney(r.amount) : "—"}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isTransfer && (
                          <FormDialog
                            trigger={
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit bank transfer">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            }
                            title="Edit bank transfer"
                            description="Change the amount, bank, date, or direction."
                          >
                            {(close) => (
                              <TransferForm
                                transfer={transfer}
                                banks={data?.banks ?? []}
                                onDone={() => { invalidateAll(); close(); }}
                              />
                            )}
                          </FormDialog>
                        )}
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this cash entry?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {isTransfer
                                    ? "This will remove the bank transfer and reverse the cash and bank balances. This cannot be undone."
                                    : "This will remove the cash adjustment and update your cash on hand. This cannot be undone."}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => {
                                    if (isTransfer) deleteTransfer.mutate(transfer.id);
                                    else deleteLedger.mutate(r.id);
                                  }}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {!canDelete && (
                          <span className="text-xs text-muted-foreground pr-2">Edit at source</span>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const adjSchema = z.object({
  tx_date: z.string().min(1),
  direction: z.enum(["in", "out"]),
  amount: z.coerce.number().positive(),
  note: z.string().max(300).nullable(),
});

function AdjustmentForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    tx_date: format(new Date(), "yyyy-MM-dd"),
    direction: "in" as "in" | "out",
    amount: "",
    note: "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const parsed = adjSchema.parse({ ...form, note: form.note || null });
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("cash_ledger").insert({
        ...parsed,
        source_type: "adjustment",
        created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adjustment posted");
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-3">
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Input type="date" required value={form.tx_date} onChange={(e) => setForm({ ...form, tx_date: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Direction</Label>
        <Select value={form.direction} onValueChange={(v: any) => setForm({ ...form, direction: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="in">Cash In</SelectItem>
            <SelectItem value="out">Cash Out</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Amount (Rs)</Label>
        <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Note</Label>
        <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Post"}</Button>
      </div>
    </form>
  );
}

const transferSchema = z.object({
  tx_date: z.string().min(1),
  direction: z.enum(["deposit", "withdrawal"]),
  amount: z.coerce.number().positive(),
  bank_id: z.string().uuid(),
  note: z.string().max(300).nullable(),
});

function TransferForm({
  transfer,
  banks,
  onDone,
}: {
  transfer: any;
  banks: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    tx_date: transfer.tx_date as string,
    direction: transfer.direction as "deposit" | "withdrawal",
    amount: String(transfer.amount ?? ""),
    bank_id: transfer.bank_id as string,
    note: (transfer.note as string) ?? "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const parsed = transferSchema.parse({ ...form, note: form.note || null });
      const { error } = await (supabase as any)
        .from("cash_bank_transfers")
        .update(parsed)
        .eq("id", transfer.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Transfer updated"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-3">
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Input type="date" required value={form.tx_date} onChange={(e) => setForm({ ...form, tx_date: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Direction</Label>
        <Select value={form.direction} onValueChange={(v: any) => setForm({ ...form, direction: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="deposit">Deposit (Cash → Bank)</SelectItem>
            <SelectItem value="withdrawal">Withdrawal (Bank → Cash)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Bank</Label>
        <Select value={form.bank_id} onValueChange={(v) => setForm({ ...form, bank_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
          <SelectContent>
            {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Amount (Rs)</Label>
        <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Note</Label>
        <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
