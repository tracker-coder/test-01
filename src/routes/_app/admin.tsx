import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Save } from "lucide-react";
import { formatPKR, formatMoney, formatKgG, kgGramToGrams, gramsToKgGram } from "@/lib/format";
import { KgGramInput } from "@/components/kg-gram-input";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Users & Settings — GUL Paper" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: roles } = await (supabase as any).from("user_roles").select("role").eq("user_id", data.user.id);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      if (!isAdmin) throw redirect({ to: "/" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  return (
    <div>
      <PageHeader title="Admin" description="Users, business settings, and opening balances for an already-established business." />
      <Tabs defaultValue="team">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="team">Team &amp; settings</TabsTrigger>
          <TabsTrigger value="openings">Opening balances</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <SettingsCard />
            <InviteCard />
          </div>
          <UsersTable />
        </TabsContent>

        <TabsContent value="openings" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Set your Day 1 balances so the app reflects your real position. All openings can be edited any time.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <OpeningCashCard />
            <BankOpeningsCard />
          </div>
          <ProductOpeningsCard />
          <PartyOpeningsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<{ business_name: string } | null>(null);
  const state = form ?? { business_name: data?.business_name ?? "GUL Paper" };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("settings").update({
        business_name: state.business_name,
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <h3 className="font-display font-semibold">Business settings</h3>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-3 grid gap-3">
        <div className="space-y-1.5">
          <Label>Business name</Label>
          <Input value={state.business_name} onChange={(e) => setForm({ ...state, business_name: e.target.value })} />
        </div>
        <p className="text-xs text-muted-foreground">Currency: PKR (Rs). Set opening cash under the <b>Opening balances</b> tab.</p>
        <div className="flex justify-end">
          <Button type="submit" size="sm" className="gap-1" disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>
        </div>
      </form>
    </Card>
  );
}

/* --------------------------- Opening: Cash --------------------------- */

function OpeningCashCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<{ amount: string; date: string } | null>(null);
  const state = form ?? {
    amount: String(data?.opening_cash ?? 0),
    date: data?.opening_cash_date ?? new Date().toISOString().slice(0, 10),
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("settings").update({
        opening_cash: Number(state.amount || 0),
        opening_cash_date: state.date,
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opening cash saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <h3 className="font-display font-semibold">Opening cash on hand</h3>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-3 grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Amount (Rs)</Label>
          <Input type="number" step="0.01" value={state.amount} onChange={(e) => setForm({ ...state, amount: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>As of date</Label>
          <Input type="date" value={state.date} onChange={(e) => setForm({ ...state, date: e.target.value })} />
        </div>
        <p className="col-span-2 text-xs text-muted-foreground">Re-baselines your cash on hand from this date.</p>
        <div className="col-span-2 flex justify-end">
          <Button type="submit" size="sm" className="gap-1" disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>
        </div>
      </form>
    </Card>
  );
}

/* --------------------------- Opening: Banks --------------------------- */

function BankOpeningsCard() {
  const qc = useQueryClient();
  const { data: banks } = useQuery({
    queryKey: ["banks-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("banks").select("*").order("bank_name");
      if (error) throw error;
      return data as any[];
    },
  });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { error } = await (supabase as any).from("banks").update({ opening_balance: amount }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bank opening updated");
      qc.invalidateQueries({ queryKey: ["banks-all"] });
      qc.invalidateQueries({ queryKey: ["bank_balances"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <h3 className="font-display font-semibold">Opening bank balances</h3>
      <p className="text-xs text-muted-foreground mt-1">Amount already sitting in each account on Day 1.</p>
      <div className="mt-3 space-y-2">
        {(banks ?? []).length === 0 && <p className="text-sm text-muted-foreground">Add a bank first from the Banks page.</p>}
        {(banks ?? []).map((b: any) => {
          const value = edits[b.id] ?? String(b.opening_balance ?? 0);
          const dirty = edits[b.id] != null && Number(edits[b.id]) !== Number(b.opening_balance);
          return (
            <div key={b.id} className="flex items-center gap-2">
              <div className="flex-1 text-sm">
                <div className="font-medium">{b.bank_name}</div>
                <div className="text-xs text-muted-foreground">{b.account_title}</div>
              </div>
              <Input
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setEdits({ ...edits, [b.id]: e.target.value })}
                className="w-40"
              />
              <Button
                size="sm"
                variant={dirty ? "default" : "outline"}
                disabled={!dirty || save.isPending}
                onClick={() => save.mutate({ id: b.id, amount: Number(edits[b.id] || 0) })}
              >
                Save
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* --------------------------- Opening: Products --------------------------- */

function ProductOpeningsCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["product-openings"],
    queryFn: async () => {
      const [products, openings] = await Promise.all([
        (supabase as any).from("products").select("*").eq("is_active", true).order("name"),
        (supabase as any).from("product_openings").select("*"),
      ]);
      const byId: Record<string, any> = {};
      (openings.data ?? []).forEach((o: any) => (byId[o.product_id] = o));
      return (products.data ?? []).map((p: any) => ({ ...p, opening: byId[p.id] }));
    },
  });
  const [edits, setEdits] = useState<Record<string, { kg: string; g: string; as_of: string }>>({});

  const save = useMutation({
    mutationFn: async ({ product_id, quantity_g, as_of }: { product_id: string; quantity_g: number; as_of: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("product_openings").upsert({
        product_id, quantity_g, as_of, updated_by: u.user?.id, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opening stock saved");
      qc.invalidateQueries({ queryKey: ["product-openings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <h3 className="font-display font-semibold">Opening stock per product</h3>
      <p className="text-xs text-muted-foreground mt-1">Stock on hand of each product on Day 1 (in Kg + Gram).</p>
      <div className="mt-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Current opening</TableHead>
              <TableHead>New opening</TableHead>
              <TableHead>As of</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((p: any) => {
              const current = p.opening?.quantity_g ?? 0;
              const { kg, g } = gramsToKgGram(current);
              const e = edits[p.id] ?? { kg: String(kg), g: String(g), as_of: p.opening?.as_of ?? new Date().toISOString().slice(0, 10) };
              const grams = kgGramToGrams(e.kg, e.g);
              const dirty = grams !== current || e.as_of !== (p.opening?.as_of ?? new Date().toISOString().slice(0, 10));
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{current ? formatKgG(current) : "—"}</TableCell>
                  <TableCell>
                    <div className="w-56"><KgGramInput label="" kg={e.kg} g={e.g} onChange={(kg, g) => setEdits({ ...edits, [p.id]: { ...e, kg, g } })} /></div>
                  </TableCell>
                  <TableCell>
                    <Input type="date" value={e.as_of} onChange={(ev) => setEdits({ ...edits, [p.id]: { ...e, as_of: ev.target.value } })} className="w-40" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate({ product_id: p.id, quantity_g: grams, as_of: e.as_of })}>Save</Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {(data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No active products.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* --------------------------- Opening: Parties --------------------------- */

function PartyOpeningsCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["party-openings"],
    queryFn: async () => {
      const [customers, suppliers, openings] = await Promise.all([
        (supabase as any).from("customers").select("id,name").eq("is_active", true).order("name"),
        (supabase as any).from("suppliers").select("id,name").eq("is_active", true).order("name"),
        (supabase as any).from("party_openings").select("*"),
      ]);
      return {
        customers: (customers.data ?? []) as any[],
        suppliers: (suppliers.data ?? []) as any[],
        openings: (openings.data ?? []) as any[],
      };
    },
  });

  const [type, setType] = useState<"customer" | "supplier">("customer");
  const [partyId, setPartyId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"receivable" | "payable">("receivable");
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const partyList = type === "customer" ? data?.customers ?? [] : data?.suppliers ?? [];
  const openings = (data?.openings ?? []).map((o: any) => {
    const list = o.party_type === "customer" ? data?.customers ?? [] : data?.suppliers ?? [];
    return { ...o, party_name: list.find((p: any) => p.id === o.party_id)?.name ?? "(unknown)" };
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!partyId) throw new Error("Select a party");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("party_openings").upsert({
        party_type: type,
        party_id: partyId,
        amount: Number(amount || 0),
        direction,
        as_of: asOf,
        note: note || null,
        updated_by: u.user?.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "party_type,party_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opening balance saved");
      qc.invalidateQueries({ queryKey: ["party-openings"] });
      setAmount(""); setNote("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("party_openings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["party-openings"] });
    },
  });

  const totalReceivable = openings.filter((o) => o.direction === "receivable").reduce((s, o) => s + Number(o.amount), 0);
  const totalPayable = openings.filter((o) => o.direction === "payable").reduce((s, o) => s + Number(o.amount), 0);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-display font-semibold">Opening customer &amp; supplier balances</h3>
          <p className="text-xs text-muted-foreground mt-1">Money you already owe or that's already owed to you on Day 1.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-md border px-2 py-1"><span className="text-muted-foreground">Receivable </span><b className="text-success">{formatPKR(totalReceivable)}</b></span>
          <span className="rounded-md border px-2 py-1"><span className="text-muted-foreground">Payable </span><b className="text-destructive">{formatPKR(totalPayable)}</b></span>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-4 grid gap-3 sm:grid-cols-6">
        <div className="space-y-1.5 sm:col-span-1">
          <Label>Party type</Label>
          <Select value={type} onValueChange={(v: any) => { setType(v); setPartyId(""); setDirection(v === "customer" ? "receivable" : "payable"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="supplier">Supplier</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Party</Label>
          <Select value={partyId} onValueChange={setPartyId}>
            <SelectTrigger><SelectValue placeholder={`Select ${type}`} /></SelectTrigger>
            <SelectContent>
              {partyList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label>Amount (Rs)</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label>Direction</Label>
          <Select value={direction} onValueChange={(v: any) => setDirection(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="receivable">They owe you</SelectItem>
              <SelectItem value="payable">You owe them</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label>As of</Label>
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-5">
          <Label>Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="sm:col-span-1 flex items-end justify-end">
          <Button type="submit" disabled={save.isPending} className="w-full">Save</Button>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>As of</TableHead>
              <TableHead>Note</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {openings.length === 0 && <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">No opening balances yet.</TableCell></TableRow>}
            {openings.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="capitalize">{o.party_type}</TableCell>
                <TableCell className="font-medium">{o.party_name}</TableCell>
                <TableCell>
                  <Badge variant={o.direction === "receivable" ? "default" : "secondary"}>
                    {o.direction === "receivable" ? "They owe" : "You owe"}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right tabular-nums font-medium ${o.direction === "receivable" ? "text-success" : "text-destructive"}`}>{formatMoney(o.amount)}</TableCell>
                <TableCell>{o.as_of}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{o.note ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => confirm("Remove this opening?") && del.mutate(o.id)}>Remove</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* --------------------------- Users --------------------------- */

function InviteCard() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: { full_name: name.trim() || undefined },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Invite email sent to ${email}`);
      setEmail(""); setName("");
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card className="p-4">
      <h3 className="font-display font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4" /> Invite user</h3>
      <p className="text-xs text-muted-foreground mt-1">Sends a magic-link. New users join as <b>Staff</b>; promote them below.</p>
      <form onSubmit={(e) => { e.preventDefault(); invite.mutate(); }} className="mt-3 grid gap-3">
        <div className="space-y-1.5">
          <Label>Full name (optional)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={invite.isPending}>{invite.isPending ? "Sending…" : "Send invite"}</Button>
        </div>
      </form>
    </Card>
  );
}

function UsersTable() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        (supabase as any).from("profiles").select("*").order("created_at", { ascending: false }),
        (supabase as any).from("user_roles").select("user_id, role"),
      ]);
      const rolesByUser: Record<string, string[]> = {};
      (roles.data ?? []).forEach((r: any) => {
        rolesByUser[r.user_id] = [...(rolesByUser[r.user_id] ?? []), r.role];
      });
      return (profiles.data ?? []).map((p: any) => ({ ...p, roles: rolesByUser[p.id] ?? [] }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role, add }: { userId: string; role: "admin" | "staff"; add: boolean }) => {
      if (add) {
        const { error } = await (supabase as any).from("user_roles").insert({ user_id: userId, role });
        if (error && !`${error.message}`.includes("duplicate")) throw error;
      } else {
        const { error } = await (supabase as any).from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-list"] });
      qc.invalidateQueries({ queryKey: ["my-roles"] });
      toast.success("Role updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any).from("profiles").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users-list"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <div className="border-b p-3">
        <h3 className="font-display font-semibold">Team members</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {(data ?? []).map((u: any) => {
              const isAdmin = u.roles.includes("admin");
              return (
                <TableRow key={u.id} className={!u.is_active ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                  <TableCell>{u.phone ?? "—"}</TableCell>
                  <TableCell className="flex gap-1">
                    {u.roles.map((r: string) => <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="capitalize">{r}</Badge>)}
                    {u.roles.length === 0 && <span className="text-xs text-muted-foreground">No role</span>}
                  </TableCell>
                  <TableCell>{u.is_active ? <Badge variant="outline" className="text-success border-success/40">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setRole.mutate({ userId: u.id, role: "admin", add: !isAdmin })}>
                      {isAdmin ? "Revoke admin" : "Make admin"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleActive.mutate({ id: u.id, active: !u.is_active })}>
                      {u.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
