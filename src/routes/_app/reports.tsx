import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DateRangeSelect, useDateRange } from "@/components/date-range-select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPKR, formatMoney, formatKgG, formatKg } from "@/lib/format";
import { displayDate } from "@/lib/date-range";
import { format } from "date-fns";
import { Download, FileText } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { shareOnWhatsApp } from "@/lib/whatsapp";
import { shareReportPdf } from "@/lib/pdf-report";
import { CuttingReportTab } from "@/components/cutting-report-tab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";


export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports — GUL Paper" }] }),
  component: ReportsPage,
});

function toCSV(rows: any[], headers: { key: string; label: string; fmt?: (v: any, r: any) => string }[]) {
  const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map((h) => esc(h.label)).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(h.fmt ? h.fmt(r[h.key], r) : r[h.key])).join(","));
  }
  return lines.join("\n");
}

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const dr = useDateRange("month");
  const from = format(dr.range.from, "yyyy-MM-dd");
  const to = format(dr.range.to, "yyyy-MM-dd");

  const q = useQuery({
    queryKey: ["reports", from, to],
    queryFn: async () => {
      const [sales, services, purchases, expenses, parties] = await Promise.all([
        (supabase as any).from("sales").select("*, customers(name), banks(bank_name), sale_items(quantity_g, rate, line_total, products(name))").gte("sale_date", from).lte("sale_date", to).order("sale_date"),
        (supabase as any).from("service_sales").select("*, customers(name), banks(bank_name)").gte("sale_date", from).lte("sale_date", to).order("sale_date"),
        (supabase as any).from("purchases").select("*, suppliers(name), purchase_items(quantity_g, rate, line_total, products(name))").gte("purchase_date", from).lte("purchase_date", to).order("purchase_date"),
        (supabase as any).from("expenses").select("*, expense_categories(name), banks(bank_name)").gte("expense_date", from).lte("expense_date", to).order("expense_date"),
        (supabase as any).from("party_balances").select("*"),
      ]);
      return {
        sales: (sales.data ?? []) as any[],
        services: (services.data ?? []) as any[],
        purchases: (purchases.data ?? []) as any[],
        expenses: (expenses.data ?? []) as any[],
        parties: (parties.data ?? []) as any[],
      };
    },
  });

  const sales = q.data?.sales ?? [];
  const services = q.data?.services ?? [];
  const servicesTotal = services.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const purchases = q.data?.purchases ?? [];
  const expenses = q.data?.expenses ?? [];
  const receivables = (q.data?.parties ?? []).filter((p: any) => p.party_type === "customer" && Math.abs(Number(p.balance)) > 0.005);
  const payables = (q.data?.parties ?? []).filter((p: any) => p.party_type === "supplier" && Math.abs(Number(p.balance)) > 0.005);

  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const supplierOptions = useMemo(
    () => Array.from(new Set(purchases.map((r: any) => r.suppliers?.name).filter(Boolean) as string[])).sort(),
    [purchases],
  );
  const filteredPurchases = useMemo(
    () => (supplierFilter === "all" ? purchases : purchases.filter((r: any) => (r.suppliers?.name ?? "") === supplierFilter)),
    [purchases, supplierFilter],
  );
  const invoiceGrams = (r: any) => (r.purchase_items ?? []).reduce((g: number, it: any) => g + Number(it.quantity_g || 0), 0);
  const purchaseGrams = filteredPurchases.reduce((g: number, r: any) => g + invoiceGrams(r), 0);
  const purchaseTotal = filteredPurchases.reduce((s: number, r: any) => s + Number(r.total_amount), 0);
  const productTotals = useMemo(() => {
    const m = new Map<string, { name: string; grams: number; amount: number }>();
    for (const r of filteredPurchases as any[]) {
      for (const it of r.purchase_items ?? []) {
        const name = it.products?.name ?? "—";
        const cur = m.get(name) ?? { name, grams: 0, amount: 0 };
        cur.grams += Number(it.quantity_g || 0);
        cur.amount += Number(it.line_total || 0);
        m.set(name, cur);
      }
    }
    return Array.from(m.values()).sort((a, b) => b.grams - a.grams);
  }, [filteredPurchases]);



  return (
    <div>
      <PageHeader
        title="Reports"
        description="Detailed transaction reports with CSV export."
        actions={<DateRangeSelect {...dr} />}
      />

      <Tabs defaultValue="sales">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="sales">Sales ({sales.length})</TabsTrigger>
          <TabsTrigger value="purchases">Purchases ({purchases.length})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
          <TabsTrigger value="receivables">Receivables ({receivables.length})</TabsTrigger>
          <TabsTrigger value="payables">Payables ({payables.length})</TabsTrigger>
          <TabsTrigger value="cutting">Cutting</TabsTrigger>
          <TabsTrigger value="pnl">Profit &amp; Loss</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <ReportCard
            title="Sales report"
            total={sales.reduce((s, r) => s + Number(r.total_amount), 0) + servicesTotal}
            onExport={() => {
              const lines = [
                ...sales.flatMap((r: any) =>
                  (r.sale_items ?? []).map((it: any) => ({
                    sale_date: r.sale_date,
                    customer: r.customers?.name ?? "",
                    product: it.products?.name ?? "",
                    qty: formatKgG(it.quantity_g),
                    qty_g: it.quantity_g,
                    rate: it.rate,
                    line_total: it.line_total,
                    invoice_total: r.total_amount,
                    bank: r.banks?.bank_name ?? "",
                    reference_no: r.reference_no ?? "",
                  })),
                ),
                ...services.map((r: any) => ({
                  sale_date: r.sale_date,
                  customer: r.customers?.name ?? "",
                  product: `${r.service_name} (service)`,
                  qty: "",
                  qty_g: "",
                  rate: "",
                  line_total: r.amount,
                  invoice_total: r.amount,
                  bank: r.banks?.bank_name ?? "",
                  reference_no: "",
                })),
              ];
              download(`sales-${from}-to-${to}.csv`, toCSV(lines, [
                { key: "sale_date", label: "Date" },
                { key: "customer", label: "Customer" },
                { key: "product", label: "Product / Service" },
                { key: "qty", label: "Qty" },
                { key: "qty_g", label: "Qty (g)" },
                { key: "rate", label: "Rate/kg" },
                { key: "line_total", label: "Line total" },
                { key: "invoice_total", label: "Invoice total" },
                { key: "bank", label: "Bank" },
                { key: "reference_no", label: "Reference" },
              ]));
            }}
            onShare={() => {
              const total = sales.reduce((s, r: any) => s + Number(r.total_amount), 0) + servicesTotal;
              const body = [
                ...sales.map((r: any) => `${displayDate(r.sale_date)}  ${r.customers?.name ?? "—"}  ${formatPKR(r.total_amount)}`),
                ...services.map((r: any) => `${displayDate(r.sale_date)}  ${r.service_name} (service)  ${formatPKR(r.amount)}`),
              ].join("\n");
              shareOnWhatsApp(`*Sales report* (${from} → ${to})\n\n${body || "(no sales)"}\n\n*Total: ${formatPKR(total)}*`);
            }}
            onPdf={() => {
              const grams = (r: any) => (r.sale_items ?? []).reduce((g: number, it: any) => g + Number(it.quantity_g || 0), 0);
              const totalGrams = sales.reduce((g: number, r: any) => g + grams(r), 0);
              const total = sales.reduce((s, r: any) => s + Number(r.total_amount), 0) + servicesTotal;
              shareReportPdf(`sales-${from}-to-${to}.pdf`, {
                title: "Sales report",
                subtitle: `${displayDate(from)} — ${displayDate(to)}`,
                head: ["Date", "Customer", "Items", "Weight", "Amount"],
                numericColumns: [3, 4],
                body: [
                  ...sales.map((r: any) => [
                    displayDate(r.sale_date),
                    r.customers?.name ?? "—",
                    (r.sale_items ?? []).map((it: any) => it.products?.name ?? "—").join(", ") || "—",
                    formatKg(grams(r)),
                    formatMoney(r.total_amount),
                  ]),
                  ...services.map((r: any) => [displayDate(r.sale_date), r.customers?.name ?? "—", `${r.service_name} (service)`, "—", formatMoney(r.amount)]),
                ],
                totals: [
                  { label: "Total weight", value: formatKg(totalGrams) },
                  { label: "Total amount", value: formatPKR(total) },
                ],
              }, `*Sales report* (${displayDate(from)} — ${displayDate(to)})\nTotal weight: ${formatKg(totalGrams)}\nTotal amount: ${formatPKR(total)}\n(PDF downloaded — attach it here)`);
            }}
          >
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Items</TableHead><TableHead>Bank</TableHead><TableHead className="text-right">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {sales.map((r: any) => (
                  <TableRow key={`s-${r.id}`}>
                    <TableCell>{displayDate(r.sale_date)}</TableCell>
                    <TableCell>{r.customers?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{(r.sale_items ?? []).map((it: any) => `${it.products?.name ?? "—"} (${formatKgG(it.quantity_g)})`).join(", ") || "—"}</TableCell>
                    <TableCell>{r.banks?.bank_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.total_amount)}</TableCell>
                  </TableRow>
                ))}
                {services.map((r: any) => (
                  <TableRow key={`sv-${r.id}`}>
                    <TableCell>{displayDate(r.sale_date)}</TableCell>
                    <TableCell>{r.customers?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs"><span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide mr-2">Service</span>{r.service_name}</TableCell>
                    <TableCell>{r.paid_by === "cash" ? "Cash" : (r.banks?.bank_name ?? "—")}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportCard>
        </TabsContent>


        <TabsContent value="purchases">
          <ReportCard
            title="Purchases report"
            total={purchaseTotal}
            headerExtra={
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="All suppliers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All suppliers</SelectItem>
                  {supplierOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
            onExport={() => {
              const lines = filteredPurchases.flatMap((r: any) =>
                (r.purchase_items ?? []).map((it: any) => ({
                  purchase_date: r.purchase_date,
                  supplier: r.suppliers?.name ?? "",
                  product: it.products?.name ?? "",
                  qty: formatKgG(it.quantity_g),
                  qty_g: it.quantity_g,
                  rate: it.rate,
                  line_total: it.line_total,
                  invoice_total: r.total_amount,
                })),
              );
              download(`purchases-${from}-to-${to}.csv`, toCSV(lines, [
                { key: "purchase_date", label: "Date" },
                { key: "supplier", label: "Supplier" },
                { key: "product", label: "Product" },
                { key: "qty", label: "Qty" },
                { key: "qty_g", label: "Qty (g)" },
                { key: "rate", label: "Rate/kg" },
                { key: "line_total", label: "Line total" },
                { key: "invoice_total", label: "Invoice total" },
              ]));
            }}
            onShare={() => {
              const body = filteredPurchases.map((r: any) => `${displayDate(r.purchase_date)}  ${r.suppliers?.name ?? "—"}  ${formatKg(invoiceGrams(r))}  ${formatPKR(r.total_amount)}`).join("\n");
              const byProd = productTotals.map((p) => `${p.name}: ${formatKg(p.grams)}  ${formatPKR(p.amount)}`).join("\n");
              shareOnWhatsApp(
                `*Purchases report* (${from} → ${to})${supplierFilter !== "all" ? `\nSupplier: ${supplierFilter}` : ""}\n\n${body || "(no purchases)"}\n\n*Weight by product*\n${byProd || "—"}\n\n*Grand total weight: ${formatKg(purchaseGrams)}*\n*Grand total amount: ${formatPKR(purchaseTotal)}*`,
              );
            }}
            onPdf={() => {
              shareReportPdf(`purchases-${from}-to-${to}.pdf`, {
                title: "Purchases report",
                subtitle: `${displayDate(from)} — ${displayDate(to)}${supplierFilter !== "all" ? ` • ${supplierFilter}` : ""}`,
                head: ["Date", "Supplier", "Items", "Weight", "Amount"],
                numericColumns: [3, 4],
                body: filteredPurchases.map((r: any) => [
                  displayDate(r.purchase_date),
                  r.suppliers?.name ?? "—",
                  (r.purchase_items ?? []).map((it: any) => it.products?.name ?? "—").join(", ") || "—",
                  formatKg(invoiceGrams(r)),
                  formatMoney(r.total_amount),
                ]),
                sections: productTotals.length
                  ? [{
                      title: "Weight by product",
                      head: ["Product", "Weight", "Amount"],
                      numericColumns: [1, 2],
                      body: [
                        ...productTotals.map((p) => [p.name, formatKg(p.grams), formatMoney(p.amount)]),
                        ["Grand total", formatKg(purchaseGrams), formatMoney(purchaseTotal)],
                      ],
                    }]
                  : [],
                totals: [
                  { label: "Grand total weight", value: formatKg(purchaseGrams) },
                  { label: "Grand total amount", value: formatPKR(purchaseTotal) },
                ],
              }, `*Purchases report* (${displayDate(from)} — ${displayDate(to)})\nGrand total weight: ${formatKg(purchaseGrams)}\nGrand total amount: ${formatPKR(purchaseTotal)}\n(PDF downloaded — attach it here)`);
            }}
          >
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Weight</TableHead><TableHead className="text-right">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredPurchases.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{displayDate(r.purchase_date)}</TableCell>
                    <TableCell>{r.suppliers?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{(r.purchase_items ?? []).map((it: any) => `${it.products?.name ?? "—"} (${formatKgG(it.quantity_g)})`).join(", ") || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatKg(invoiceGrams(r))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.total_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportCard>

          {productTotals.length > 0 && (
            <div className="rounded-xl border bg-card mt-4">
              <div className="flex items-center justify-between border-b p-3">
                <div>
                  <h3 className="font-display font-semibold">Weight by product</h3>
                  <div className="text-xs text-muted-foreground">Grand weight: <span className="text-foreground font-medium tabular-nums">{formatKg(purchaseGrams)}</span> · Grand amount: <span className="text-foreground font-medium tabular-nums">{formatPKR(purchaseTotal)}</span></div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Product</TableHead><TableHead className="text-right">Weight</TableHead><TableHead className="text-right">Amount</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {productTotals.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatKg(p.grams)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 font-medium">
                      <TableCell>Grand total</TableCell>
                      <TableCell className="text-right tabular-nums">{formatKg(purchaseGrams)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(purchaseTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>



        <TabsContent value="expenses">
          <ReportCard
            title="Expenses report"
            total={expenses.reduce((s, r) => s + Number(r.amount), 0)}
            onExport={() =>
              download(`expenses-${from}-to-${to}.csv`, toCSV(expenses, [
                { key: "expense_date", label: "Date" },
                { key: "expense_categories", label: "Category", fmt: (v) => v?.name ?? "" },
                { key: "description", label: "Description" },
                { key: "paid_by", label: "Paid by" },
                { key: "banks", label: "Bank", fmt: (v) => v?.bank_name ?? "" },
                { key: "amount", label: "Amount" },
              ]))
            }
            onShare={() => {
              const total = expenses.reduce((s, r: any) => s + Number(r.amount), 0);
              const body = expenses.map((r: any) => `${displayDate(r.expense_date)}  ${r.expense_categories?.name ?? "—"}  ${formatPKR(r.amount)}`).join("\n");
              shareOnWhatsApp(`*Expenses report* (${from} → ${to})\n\n${body || "(no expenses)"}\n\n*Total: ${formatPKR(total)}*`);
            }}
            onPdf={() => {
              const total = expenses.reduce((s, r: any) => s + Number(r.amount), 0);
              shareReportPdf(`expenses-${from}-to-${to}.pdf`, {
                title: "Expenses report",
                subtitle: `${displayDate(from)} — ${displayDate(to)}`,
                head: ["Date", "Category", "Description", "Paid by", "Amount"],
                numericColumns: [4],
                body: expenses.map((r: any) => [
                  displayDate(r.expense_date),
                  r.expense_categories?.name ?? "—",
                  r.description ?? "—",
                  `${r.paid_by}${r.banks?.bank_name ? ` • ${r.banks.bank_name}` : ""}`,
                  formatMoney(r.amount),
                ]),
                totals: [{ label: "Total amount", value: formatPKR(total) }],
              }, `*Expenses report* (${displayDate(from)} — ${displayDate(to)})\nTotal: ${formatPKR(total)}\n(PDF downloaded — attach it here)`);
            }}
          >
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Paid by</TableHead><TableHead className="text-right">Amount</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {expenses.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{displayDate(r.expense_date)}</TableCell>
                    <TableCell>{r.expense_categories?.name ?? "—"}</TableCell>
                    <TableCell className="capitalize">{r.paid_by}{r.banks?.bank_name ? ` • ${r.banks.bank_name}` : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportCard>
        </TabsContent>


        <TabsContent value="receivables">
          <PartyBalancesCard
            title="Receivables — by customer"
            emptyLabel="No customers currently owe money."
            rows={receivables}
            partyLabel="Customer"
            filenamePrefix="receivables"
          />
        </TabsContent>

        <TabsContent value="payables">
          <PartyBalancesCard
            title="Payables — by supplier"
            emptyLabel="No suppliers currently need to be paid."
            rows={payables}
            partyLabel="Supplier"
            filenamePrefix="payables"
          />
        </TabsContent>

        <TabsContent value="cutting">
          <CuttingReportTab from={from} to={to} />
        </TabsContent>

        <TabsContent value="pnl">
          <PnlSummary sales={sales} services={services} purchases={purchases} expenses={expenses} from={from} to={to} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({ title, total, onExport, onShare, onPdf, headerExtra, children }: { title: string; total: number; onExport: () => void; onShare?: () => void; onPdf?: () => void; headerExtra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <div>
          <h3 className="font-display font-semibold">{title}</h3>
          <div className="text-xs text-muted-foreground">Total: <span className="text-foreground font-medium tabular-nums">{formatPKR(total)}</span></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerExtra}

          {onShare && (
            <Button variant="outline" size="sm" onClick={onShare} className="gap-1"><WhatsAppIcon className="h-4 w-4 text-success" /> WhatsApp</Button>
          )}
          {onPdf && (
            <Button variant="outline" size="sm" onClick={onPdf} className="gap-1"><FileText className="h-4 w-4" /> Share PDF</Button>
          )}
          <Button variant="outline" size="sm" onClick={onExport} className="gap-1"><Download className="h-4 w-4" /> Export CSV</Button>
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function PnlSummary({ sales, services, purchases, expenses, from, to }: { sales: any[]; services: any[]; purchases: any[]; expenses: any[]; from: string; to: string }) {
  const sProd = sales.reduce((a, r) => a + Number(r.total_amount), 0);
  const sSvc = services.reduce((a, r) => a + Number(r.amount), 0);
  const s = sProd + sSvc;
  const p = purchases.reduce((a, r) => a + Number(r.total_amount), 0);
  const e = expenses.reduce((a, r) => a + Number(r.amount), 0);
  const gross = s - p;
  const net = gross - e;
  const share = () => {
    shareOnWhatsApp(
      [
        `*Profit & Loss* (${from} → ${to})`,
        ``,
        `Product sales: ${formatPKR(sProd)}`,
        `Service revenue: ${formatPKR(sSvc)}`,
        `Total revenue: ${formatPKR(s)}`,
        `Cost of goods: -${formatPKR(p)}`,
        `Gross profit: ${formatPKR(gross)}`,
        `Operating expenses: -${formatPKR(e)}`,
        `*Net profit: ${formatPKR(net)}*`,
      ].join("\n"),
    );
  };
  return (
    <div className="mt-3 rounded-xl border bg-card p-6 max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold">Profit &amp; Loss</h3>
        <Button variant="outline" size="sm" onClick={share} className="gap-1"><WhatsAppIcon className="h-4 w-4 text-success" /> WhatsApp</Button>
      </div>
      <dl className="space-y-2 text-sm">
        <Row label="Product sales" value={sProd} />
        <Row label="Service revenue" value={sSvc} />
        <Row label="Total revenue" value={s} bold />
        <Row label="Cost of goods (purchases)" value={-p} />
        <Row label="Gross profit" value={gross} bold />
        <Row label="Operating expenses" value={-e} />
        <div className="border-t pt-2">
          <Row label="Net profit" value={net} bold tone={net >= 0 ? "success" : "destructive"} />
        </div>
      </dl>
    </div>
  );
}


function Row({ label, value, bold, tone }: { label: string; value: number; bold?: boolean; tone?: "success" | "destructive" }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={bold ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={`tabular-nums ${bold ? "font-semibold" : ""} ${tone === "success" ? "text-success" : ""} ${tone === "destructive" ? "text-destructive" : ""}`}>
        {formatPKR(value)}
      </dd>
    </div>
  );
}

function PartyBalancesCard({
  title, emptyLabel, rows, partyLabel, filenamePrefix,
}: { title: string; emptyLabel: string; rows: any[]; partyLabel: string; filenamePrefix: string }) {
  const total = rows.reduce((s, r) => s + Number(r.balance ?? 0), 0);
  const sorted = [...rows].sort((a, b) => Number(b.balance) - Number(a.balance));
  return (
    <ReportCard
      title={title}
      total={total}
      onExport={() =>
        download(`${filenamePrefix}-${format(new Date(), "yyyy-MM-dd")}.csv`, toCSV(sorted, [
          { key: "name", label: partyLabel },
          { key: "balance", label: "Balance (Rs)" },
        ]))
      }
      onShare={() => {
        const body = sorted.map((r: any) => `${r.name}  ${formatPKR(r.balance)}`).join("\n");
        shareOnWhatsApp(`*${title}*\n\n${body || emptyLabel}\n\n*Total: ${formatPKR(total)}*`);
      }}
      onPdf={() =>
        shareReportPdf(`${filenamePrefix}-${format(new Date(), "yyyy-MM-dd")}.pdf`, {
          title,
          subtitle: `As of ${format(new Date(), "dd MMM yyyy")}`,
          head: [partyLabel, "Balance"],
          numericColumns: [1],
          body: sorted.map((r: any) => [r.name, formatMoney(r.balance)]),
          totals: [{ label: "Total", value: formatPKR(total) }],
        }, `*${title}*\nTotal: ${formatPKR(total)}\n(PDF downloaded — attach it here)`)
      }
    >
      <Table>
        <TableHeader><TableRow>
          <TableHead>{partyLabel}</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">{emptyLabel}</TableCell></TableRow>
          )}
          {sorted.map((r: any) => (
            <TableRow key={`${r.party_type}-${r.party_id}`}>
              <TableCell className="font-medium">{r.name}{!r.is_active && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}</TableCell>
              <TableCell className={`text-right tabular-nums ${Number(r.balance) < 0 ? "text-destructive" : ""}`}>{formatMoney(r.balance)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ReportCard>
  );
}
