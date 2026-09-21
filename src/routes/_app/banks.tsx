import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { z } from "zod";
import { formatPKR, formatMoney } from "@/lib/format";
import { useIsAdmin } from "@/hooks/use-role";
import { KPICard } from "@/components/kpi-card";
import { Plus, Landmark, Power, Pencil, ArrowDownToLine, ArrowUpFromLine, FileText } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { shareOnWhatsApp } from "@/lib/whatsapp";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BankStatement } from "@/components/bank-statement";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/banks")({
  head: () => ({ meta: [{ title: "Banks — GUL Paper" }] }),
  component: BanksPage,
});

const schema = z.object({
  bank_name: z.string().min(1).max(80),
  account_title: z.string().min(1).max(120),
  account_number: z.string().max(60).nullable(),
  opening_balance: z.coerce.number().default(0),
});

function BanksPage() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [editRow, setEditRow] = useState<any | null>(null);
  const [stmtRow, setStmtRow] = useState<any | null>(null);

  const { data: balances, isLoading } = useQuery({
    queryKey: ["bank_balances"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bank_balances")
        .select("*")
        .order("bank_name");
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: banks } = useQuery({
    queryKey: ["banks-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("banks").select("*").order("bank_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const totalBalance = (balances ?? []).reduce((s, b: any) => s + Number(b.current_balance ?? 0), 0);
  const totalIn = (balances ?? []).reduce((s, b: any) => s + Number(b.total_in ?? 0), 0);
  const totalOut = (balances ?? []).reduce((s, b: any) => s + Number(b.total_out ?? 0), 0);

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from("banks").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["banks-all"] });
      qc.invalidateQueries({ queryKey: ["bank_balances"] });
      qc.invalidateQueries({ queryKey: ["banks", "active"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Bank Accounts"
        description="All sales are received here. Balances update automatically."
        actions={
          <div className="flex flex-wrap gap-2">
            <FormDialog
              trigger={<Button size="sm" variant="outline" className="gap-1"><ArrowDownToLine className="h-4 w-4" /> Deposit cash</Button>}
              title="Deposit cash into bank"
            >
              {(close) => <TransferForm direction="deposit" onDone={close} />}
            </FormDialog>
            <FormDialog
              trigger={<Button size="sm" variant="outline" className="gap-1"><ArrowUpFromLine className="h-4 w-4" /> Withdraw cash</Button>}
              title="Withdraw cash from bank"
            >
              {(close) => <TransferForm direction="withdrawal" onDone={close} />}
            </FormDialog>
            {isAdmin && (
              <FormDialog
                trigger={<Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add bank</Button>}
                title="Add bank account"
              >
                {(close) => <BankForm onDone={close} />}
              </FormDialog>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
        <KPICard label="Total in banks" value={totalBalance} tone="success" icon={<Landmark className="h-4 w-4" />} />
        <KPICard label="Total received" value={totalIn} />
        <KPICard label="Total paid out" value={totalOut} tone="destructive" />
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bank</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {!isLoading && (balances ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No bank accounts yet.</TableCell></TableRow>
            )}
            {(balances ?? []).map((b: any) => {
              const bank = (banks ?? []).find((x: any) => x.id === b.bank_id);
              return (
                <TableRow key={b.bank_id}>
                  <TableCell className="font-medium">{b.bank_name}</TableCell>
                  <TableCell>
                    <div className="text-sm">{b.account_title}</div>
                    {bank?.account_number && <div className="text-xs text-muted-foreground">{bank.account_number}</div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(b.opening_balance)}</TableCell>
                  <TableCell className="text-right tabular-nums text-success">{formatMoney(b.total_in)}</TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">{formatMoney(b.total_out)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatMoney(b.current_balance)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="View statement" onClick={() => setStmtRow(b)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Share statement on WhatsApp"
                      onClick={() =>
                        shareOnWhatsApp(
                          [
                            `*Bank Statement — ${b.bank_name}*`,
                            `Account: ${b.account_title}${bank?.account_number ? ` (${bank.account_number})` : ""}`,
                            ``,
                            `Opening: ${formatPKR(b.opening_balance)}`,
                            `Received (In): ${formatPKR(b.total_in)}`,
                            `Paid (Out): ${formatPKR(b.total_out)}`,
                            `*Current Balance: ${formatPKR(b.current_balance)}*`,
                          ].join("\n"),
                        )
                      }
                    >
                      <WhatsAppIcon className="h-4 w-4 text-success" />
                    </Button>
                    {isAdmin ? (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => setEditRow(bank ?? b)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggle.mutate({ id: b.bank_id, is_active: !b.is_active })}
                          title={b.is_active ? "Deactivate" : "Activate"}
                        >
                          <Power className={b.is_active ? "h-4 w-4 text-success" : "h-4 w-4 text-muted-foreground"} />
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">{b.is_active ? "Active" : "Inactive"}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit bank account</DialogTitle></DialogHeader>
          {editRow && <BankForm initial={editRow} onDone={() => setEditRow(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!stmtRow} onOpenChange={(o) => !o && setStmtRow(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{stmtRow ? `Statement — ${stmtRow.bank_name}` : "Statement"}</DialogTitle>
          </DialogHeader>
          {stmtRow && (
            <BankStatement
              bankId={stmtRow.bank_id}
              bankName={stmtRow.bank_name}
              accountTitle={stmtRow.account_title}
              openingBalance={Number(stmtRow.opening_balance ?? 0)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BankForm({ onDone, initial }: { onDone: () => void; initial?: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    bank_name: initial?.bank_name ?? "",
    account_title: initial?.account_title ?? "",
    account_number: initial?.account_number ?? "",
    opening_balance: initial?.opening_balance != null ? String(initial.opening_balance) : "0",
  });
  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        bank_name: form.bank_name.trim(),
        account_title: form.account_title.trim(),
        account_number: form.account_number.trim() || null,
        opening_balance: Number(form.opening_balance || 0),
      });
      if (initial?.id) {
        const { error } = await (supabase as any).from("banks").update(parsed).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("banks").insert(parsed);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Bank updated" : "Bank added");
      qc.invalidateQueries({ queryKey: ["bank_balances"] });
      qc.invalidateQueries({ queryKey: ["banks-all"] });
      qc.invalidateQueries({ queryKey: ["banks", "active"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-3">
      <div className="space-y-1.5">
        <Label>Bank name</Label>
        <Input required value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Account title</Label>
        <Input required value={form.account_title} onChange={(e) => setForm({ ...form, account_title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Account number</Label>
        <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Opening balance (Rs)</Label>
        <Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

function TransferForm({ direction, onDone }: { direction: "deposit" | "withdrawal"; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: banks } = useQuery({
    queryKey: ["banks", "active", "bank_name"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("banks").select("id,bank_name,account_title").eq("is_active", true).order("bank_name");
      if (error) throw error;
      return data as any[];
    },
  });
  const [form, setForm] = useState({
    tx_date: format(new Date(), "yyyy-MM-dd"),
    bank_id: "",
    amount: "",
    note: "",
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!form.bank_id) throw new Error("Please select a bank");
      const amt = Number(form.amount);
      if (!amt || amt <= 0) throw new Error("Amount must be greater than 0");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("cash_bank_transfers").insert({
        tx_date: form.tx_date,
        direction,
        bank_id: form.bank_id,
        amount: amt,
        note: form.note || null,
        created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(direction === "deposit" ? "Cash deposited to bank" : "Cash withdrawn from bank");
      qc.invalidateQueries({ queryKey: ["bank_balances"] });
      qc.invalidateQueries({ queryKey: ["cash_balance"] });
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
        <Label>Bank</Label>
        <Select value={form.bank_id} onValueChange={(v) => setForm({ ...form, bank_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
          <SelectContent>
            {(banks ?? []).map((b: any) => (
              <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Amount (Rs)</Label>
        <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Note (optional)</Label>
        <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : direction === "deposit" ? "Deposit" : "Withdraw"}
        </Button>
      </div>
    </form>
  );
}
