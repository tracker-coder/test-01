import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FormDialog } from "@/components/form-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Power, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/master")({
  head: () => ({ meta: [{ title: "Master Data — GUL Paper" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: roles } = await (supabase as any).from("user_roles").select("role").eq("user_id", data.user.id);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      if (!isAdmin) throw redirect({ to: "/" });
    }
  },
  component: MasterPage,
});

type EntityConfig = {
  table: string;
  label: string;
  fields: { key: string; label: string; type?: "text" | "textarea"; required?: boolean; placeholder?: string }[];
};

const ENTITIES: EntityConfig[] = [
  { table: "suppliers", label: "Suppliers", fields: [
    { key: "name", label: "Name", required: true },
    { key: "phone", label: "Phone" },
    { key: "notes", label: "Notes", type: "textarea" },
  ] },
  { table: "customers", label: "Customers", fields: [
    { key: "name", label: "Name", required: true },
    { key: "phone", label: "Phone" },
    { key: "notes", label: "Notes", type: "textarea" },
  ] },
  { table: "products", label: "Products", fields: [{ key: "name", label: "Name", required: true }] },
  { table: "expense_categories", label: "Expense Categories", fields: [{ key: "name", label: "Name", required: true }] },
];

function MasterPage() {
  return (
    <div>
      <PageHeader title="Master Data" description="Manage suppliers, customers, products, and expense categories." />
      <Tabs defaultValue={ENTITIES[0].table}>
        <TabsList className="flex-wrap h-auto">
          {ENTITIES.map((e) => <TabsTrigger key={e.table} value={e.table}>{e.label}</TabsTrigger>)}
        </TabsList>
        {ENTITIES.map((e) => (
          <TabsContent key={e.table} value={e.table} className="mt-4">
            <EntityTable config={e} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function EntityTable({ config }: { config: EntityConfig }) {
  const qc = useQueryClient();
  const [editRow, setEditRow] = useState<any | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["master", config.table],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(config.table).select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from(config.table).update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master", config.table] });
      qc.invalidateQueries({ queryKey: [config.table, "active"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <div className="text-sm text-muted-foreground">{data?.length ?? 0} entries</div>
        <FormDialog
          trigger={<Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add {config.label.slice(0, -1)}</Button>}
          title={`Add ${config.label.slice(0, -1)}`}
        >
          {(close) => <EntityForm config={config} onDone={close} />}
        </FormDialog>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {config.fields.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={config.fields.length + 1} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={config.fields.length + 1} className="py-8 text-center text-muted-foreground">No entries yet.</TableCell></TableRow>
            )}
            {(data ?? []).map((r) => (
              <TableRow key={r.id} className={!r.is_active ? "opacity-60" : ""}>
                {config.fields.map((f) => <TableCell key={f.key}>{r[f.key] ?? "—"}</TableCell>)}
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setEditRow(r)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggle.mutate({ id: r.id, is_active: !r.is_active })} title={r.is_active ? "Deactivate" : "Activate"}>
                    <Power className={r.is_active ? "h-4 w-4 text-success" : "h-4 w-4 text-muted-foreground"} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit {config.label.slice(0, -1)}</DialogTitle></DialogHeader>
          {editRow && <EntityForm config={config} initial={editRow} onDone={() => setEditRow(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntityForm({ config, onDone, initial }: { config: EntityConfig; onDone: () => void; initial?: any }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(config.fields.map((f) => [f.key, initial?.[f.key] != null ? String(initial[f.key]) : ""])),
  );
  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      for (const f of config.fields) {
        const v = values[f.key]?.trim();
        if (f.required && !v) throw new Error(`${f.label} is required`);
        payload[f.key] = v || null;
      }
      if (initial?.id) {
        const { error } = await (supabase as any).from(config.table).update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from(config.table).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["master", config.table] });
      qc.invalidateQueries({ queryKey: [config.table, "active"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-3">
      {config.fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label>{f.label}{f.required && " *"}</Label>
          {f.type === "textarea" ? (
            <Textarea rows={2} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          ) : (
            <Input value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          )}
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
