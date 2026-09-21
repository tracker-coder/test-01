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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { z } from "zod";
import { format } from "date-fns";
import { formatPKR, formatMoney } from "@/lib/format";
import { displayDate } from "@/lib/date-range";
import { useExpenseCategories, useBanks } from "@/hooks/use-master-data";
import { useIsAdmin } from "@/hooks/use-role";
import { Plus, Trash2, Search, Pencil, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/expenses")({
  head: () => ({ meta: [{ title: "Expenses — GUL Paper" }] }),
  component: ExpensesPage,
});

const schema = z.object({
  expense_date: z.string().min(1),
  category_id: z.string().uuid().nullable(),
  paid_by: z.enum(["cash", "bank"]),
  bank_id: z.string().uuid().nullable(),
  amount: z.coerce.number().positive(),
  description: z.string().max(500).nullable(),
  is_recurring: z.boolean(),
  recurring_day: z.coerce.number().int().min(1).max(31).nullable(),
  is_prepaid: z.boolean(),
}).refine((d) => d.is_prepaid || d.paid_by === "cash" || !!d.bank_id, { message: "Select a bank for bank payments", path: ["bank_id"] });

/** Available prepaid balance = all top-ups minus all expenses paid from prepaid. */
function usePrepaidBalance() {
  return useQuery({
    queryKey: ["prepaid-balance"],
    queryFn: async () => {
      const [tops, exps] = await Promise.all([
        (supabase as any).from("prepaid_topups").select("amount"),
        (supabase as any).from("expenses").select("amount").eq("is_prepaid", true),
      ]);
      if (tops.error) throw tops.error;
      if (exps.error) throw exps.error;
      const added = (tops.data ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
      const used = (exps.data ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
      return { added, used, balance: added - used };
    },
  });
}


function ExpensesPage() {
  const dr = useDateRange("month");
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<any | null>(null);
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();

  const from = format(dr.range.from, "yyyy-MM-dd");
  const to = format(dr.range.to, "yyyy-MM-dd");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["expenses", from, to],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("expenses")
        .select("*, expense_categories(name), banks(bank_name,account_title)")
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const prepaid = usePrepaidBalance();
  const total = (rows ?? []).reduce((s, r: any) => s + Number(r.amount), 0);
  const totalPrepaid = (rows ?? []).filter((r: any) => r.is_prepaid).reduce((s, r: any) => s + Number(r.amount), 0);
  const totalCash = (rows ?? []).filter((r: any) => !r.is_prepaid && r.paid_by === "cash").reduce((s, r: any) => s + Number(r.amount), 0);
  const totalBank = total - totalCash - totalPrepaid;

  const filtered = (rows ?? []).filter((r: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.expense_categories?.name?.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q) ||
      r.banks?.bank_name?.toLowerCase().includes(q)
    );
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e: any) => toast.error(e.message || "Delete failed"),
  });

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track daily and recurring expenses paid by cash, bank, or the prepaid account."
        actions={
          <>
            <DateRangeSelect {...dr} />
            <FormDialog
              trigger={<Button size="sm" variant="outline" className="gap-1"><Wallet className="h-4 w-4" /> Prepaid account</Button>}
              title="Prepaid account"
              size="lg"
            >
              {() => <PrepaidPanel />}
            </FormDialog>
            <FormDialog
              trigger={<Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> New expense</Button>}
              title="New expense"
              size="lg"
            >
              {(close) => <ExpenseForm onDone={close} />}
            </FormDialog>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-4 rounded-xl border bg-card p-3 text-sm">
        <span className="flex items-center gap-2 font-medium"><Wallet className="h-4 w-4 text-muted-foreground" /> Prepaid account</span>
        <span className="text-muted-foreground">Added: <span className="font-semibold text-foreground tabular-nums">{formatPKR(prepaid.data?.added ?? 0)}</span></span>
        <span className="text-muted-foreground">Used: <span className="font-semibold text-foreground tabular-nums">{formatPKR(prepaid.data?.used ?? 0)}</span></span>
        <span className="text-muted-foreground">Available: <span className={`font-semibold tabular-nums ${(prepaid.data?.balance ?? 0) < 0 ? "text-destructive" : "text-success"}`}>{formatPKR(prepaid.data?.balance ?? 0)}</span></span>
      </div>



      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search category, description…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-72" />
          </div>
          <div className="text-sm text-muted-foreground flex flex-wrap gap-4">
            <span>Cash: <span className="font-semibold text-foreground tabular-nums">{formatPKR(totalCash)}</span></span>
            <span>Bank: <span className="font-semibold text-foreground tabular-nums">{formatPKR(totalBank)}</span></span>
            <span>Prepaid: <span className="font-semibold text-foreground tabular-nums">{formatPKR(totalPrepaid)}</span></span>
            <span>Total: <span className="font-semibold text-foreground tabular-nums">{formatPKR(total)}</span></span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Paid by</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No expenses in this range.</TableCell></TableRow>
              )}
              {filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{displayDate(r.expense_date)}</TableCell>
                  <TableCell>
                    {r.expense_categories?.name ?? "—"}
                    {r.is_recurring && <Badge variant="secondary" className="ml-2 text-[10px]">Recurring</Badge>}
                    {r.is_prepaid && <Badge variant="outline" className="ml-2 text-[10px]">Prepaid</Badge>}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="line-clamp-2 text-sm">{r.description ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm capitalize">{r.is_prepaid ? "Prepaid" : r.paid_by}</div>
                    {!r.is_prepaid && r.paid_by === "bank" && r.banks && <div className="text-xs text-muted-foreground">{r.banks.bank_name}</div>}
                  </TableCell>

                  <TableCell className="text-right tabular-nums font-medium">{formatMoney(r.amount)}</TableCell>
                  <TableCell>
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => setEditRow(r)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => confirm("Delete this expense?") && del.mutate(r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit expense</DialogTitle></DialogHeader>
          {editRow && <ExpenseForm initial={editRow} onDone={() => setEditRow(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpenseForm({ onDone, initial }: { onDone: () => void; initial?: any }) {
  const qc = useQueryClient();
  const cats = useExpenseCategories();
  const banks = useBanks();
  const [form, setForm] = useState({
    expense_date: initial?.expense_date ?? format(new Date(), "yyyy-MM-dd"),
    category_id: initial?.category_id ?? "",
    paid_by: (initial?.paid_by ?? "cash") as "cash" | "bank",
    bank_id: initial?.bank_id ?? "",
    amount: initial?.amount != null ? String(initial.amount) : "",
    description: initial?.description ?? "",
    is_recurring: Boolean(initial?.is_recurring),
    recurring_day: initial?.recurring_day != null ? String(initial.recurring_day) : "",
    is_prepaid: Boolean(initial?.is_prepaid),
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        expense_date: form.expense_date,
        category_id: form.category_id || null,
        paid_by: form.is_prepaid ? "cash" : form.paid_by,
        bank_id: !form.is_prepaid && form.paid_by === "bank" ? form.bank_id || null : null,
        amount: Number(form.amount),
        description: form.description || null,
        is_recurring: form.is_recurring,
        recurring_day: form.is_recurring && form.recurring_day ? Number(form.recurring_day) : null,
        is_prepaid: form.is_prepaid,
      });
      if (initial?.id) {
        const { error } = await (supabase as any).from("expenses").update(parsed).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await (supabase as any).from("expenses").insert({ ...parsed, created_by: u.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Expense updated" : "Expense saved");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["prepaid-balance"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Input type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {(cats.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Paid by</Label>
        <Select
          value={form.is_prepaid ? "prepaid" : form.paid_by}
          onValueChange={(v: any) =>
            setForm({
              ...form,
              is_prepaid: v === "prepaid",
              paid_by: v === "prepaid" ? "cash" : v,
              bank_id: v === "bank" ? form.bank_id : "",
            })
          }
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="bank">Bank</SelectItem>
            <SelectItem value="prepaid">Prepaid account</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!form.is_prepaid && form.paid_by === "bank" && (

        <div className="space-y-1.5">
          <Label>Bank account</Label>
          <Select value={form.bank_id} onValueChange={(v) => setForm({ ...form, bank_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
            <SelectContent>
              {(banks.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Amount (Rs)</Label>
        <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Description</Label>
        <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="sm:col-span-2 flex items-center justify-between rounded-md border p-3">
        <div>
          <div className="text-sm font-medium">Mark as recurring</div>
          <div className="text-xs text-muted-foreground">For reference only — auto-posting can be enabled later.</div>
        </div>
        <Switch checked={form.is_recurring} onCheckedChange={(v) => setForm({ ...form, is_recurring: v })} />
      </div>
      {form.is_recurring && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Day of month (1–31)</Label>
          <Input type="number" min={1} max={31} value={form.recurring_day} onChange={(e) => setForm({ ...form, recurring_day: e.target.value })} />
        </div>
      )}
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : (initial?.id ? "Update expense" : "Save expense")}</Button>
      </div>
    </form>
  );
}

function PrepaidPanel() {
  const qc = useQueryClient();
  const banks = useBanks();
  const isAdmin = useIsAdmin();
  const prepaid = usePrepaidBalance();
  const [form, setForm] = useState({
    tx_date: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    source: "cash" as "cash" | "bank",
    bank_id: "",
    note: "",
  });

  const { data: tops, isLoading } = useQuery({
    queryKey: ["prepaid_topups"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("prepaid_topups")
        .select("*, banks(bank_name)")
        .order("tx_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["prepaid_topups"] });
    qc.invalidateQueries({ queryKey: ["prepaid-balance"] });
    qc.invalidateQueries({ queryKey: ["cash-flow"] });
    qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    qc.invalidateQueries({ queryKey: ["bank-ledger"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount);
      if (!(amount > 0)) throw new Error("Enter an amount");
      if (form.source === "bank" && !form.bank_id) throw new Error("Select a bank account");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("prepaid_topups").insert({
        tx_date: form.tx_date,
        amount,
        source: form.source,
        bank_id: form.source === "bank" ? form.bank_id : null,
        note: form.note || null,
        created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to prepaid account");
      setForm({ ...form, amount: "", note: "" });
      refresh();
    },
    onError: (e: any) => toast.error(e.message || "Could not add balance"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("prepaid_topups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Top-up removed"); refresh(); },
    onError: (e: any) => toast.error(e.message || "Delete failed"),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Added</div>
          <div className="font-semibold tabular-nums">{formatPKR(prepaid.data?.added ?? 0)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Used on expenses</div>
          <div className="font-semibold tabular-nums">{formatPKR(prepaid.data?.used ?? 0)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Available</div>
          <div className={`font-semibold tabular-nums ${(prepaid.data?.balance ?? 0) < 0 ? "text-destructive" : "text-success"}`}>
            {formatPKR(prepaid.data?.balance ?? 0)}
          </div>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" required value={form.tx_date} onChange={(e) => setForm({ ...form, tx_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Amount (Rs)</Label>
          <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Money taken from</Label>
          <Select value={form.source} onValueChange={(v: any) => setForm({ ...form, source: v, bank_id: v === "bank" ? form.bank_id : "" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.source === "bank" && (
          <div className="space-y-1.5">
            <Label>Bank account</Label>
            <Select value={form.bank_id} onValueChange={(v) => setForm({ ...form, bank_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
              <SelectContent>
                {(banks.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Note</Label>
          <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={add.isPending} className="gap-1">
            <Plus className="h-4 w-4" /> {add.isPending ? "Adding…" : "Add balance"}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border overflow-x-auto max-h-[40vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>}
            {!isLoading && (tops ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No balance added yet.</TableCell></TableRow>
            )}
            {(tops ?? []).map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap">{displayDate(t.tx_date)}</TableCell>
                <TableCell className="capitalize">
                  {t.source}
                  {t.banks && <div className="text-xs text-muted-foreground">{t.banks.bank_name}</div>}
                </TableCell>
                <TableCell className="max-w-[220px] truncate">{t.note ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatMoney(t.amount)}</TableCell>
                <TableCell>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => confirm("Remove this top-up?") && del.mutate(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
