import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/audit-log")({
  head: () => ({ meta: [{ title: "Audit Log — GUL Paper" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: roles } = await (supabase as any).from("user_roles").select("role").eq("user_id", data.user.id);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      if (!isAdmin) throw redirect({ to: "/" });
    }
  },
  component: AuditLogPage,
});

const TABLES = [
  { value: "all", label: "All tables" },
  { value: "sales", label: "Sales" },
  { value: "purchases", label: "Purchases" },
  { value: "expenses", label: "Expenses" },
  { value: "party_payments", label: "Party payments" },
  { value: "cash_bank_transfers", label: "Bank transfers" },
  { value: "service_sales", label: "Service sales" },
];

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-success/15 text-success border-success/30",
  UPDATE: "bg-primary/15 text-primary border-primary/30",
  DELETE: "bg-destructive/15 text-destructive border-destructive/30",
};

function AuditLogPage() {
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", tableFilter, actionFilter],
    queryFn: async () => {
      let q = (supabase as any).from("audit_log").select("*").order("created_at", { ascending: false }).limit(500);
      if (tableFilter !== "all") q = q.eq("table_name", tableFilter);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (data ?? []).filter((r: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.actor_name?.toLowerCase().includes(s) ||
      r.summary?.toLowerCase().includes(s) ||
      r.table_name?.toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <PageHeader title="Audit Log" description="Every create, edit and delete on key business records." />

      <div className="flex flex-wrap gap-2 mb-3">
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TABLES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="INSERT">Create</SelectItem>
            <SelectItem value="UPDATE">Edit</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search user or summary..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No activity yet.</TableCell></TableRow>
            )}
            {filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs">{format(new Date(r.created_at), "dd MMM yy, HH:mm")}</TableCell>
                <TableCell className="text-sm">{r.actor_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={ACTION_COLORS[r.action] ?? ""}>
                    {r.action === "INSERT" ? "Create" : r.action === "UPDATE" ? "Edit" : "Delete"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{r.table_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-md truncate">{r.summary}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setViewing(r)}>View</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activity details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">User: </span>{viewing.actor_name ?? "—"}</div>
                <div><span className="text-muted-foreground">When: </span>{format(new Date(viewing.created_at), "dd MMM yyyy, HH:mm:ss")}</div>
                <div><span className="text-muted-foreground">Action: </span>{viewing.action}</div>
                <div><span className="text-muted-foreground">Table: </span>{viewing.table_name}</div>
              </div>
              {viewing.old_data && (
                <div>
                  <div className="font-medium mb-1">Before</div>
                  <pre className="bg-muted rounded p-2 text-xs overflow-x-auto">{JSON.stringify(viewing.old_data, null, 2)}</pre>
                </div>
              )}
              {viewing.new_data && (
                <div>
                  <div className="font-medium mb-1">After</div>
                  <pre className="bg-muted rounded p-2 text-xs overflow-x-auto">{JSON.stringify(viewing.new_data, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
