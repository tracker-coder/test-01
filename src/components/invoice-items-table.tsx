import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatKgG, formatRate } from "@/lib/format";
import { lineMaths, newEmptyItem, type LineItem } from "@/lib/invoice-items";

interface Props {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  products: { id: string; name: string }[];
  /** key = `${product_id}:${party_id}` — prefills the rate last used for this party. */
  lastRates?: Record<string, number>;
  partyId: string;
  enableCutting?: boolean;
}

/**
 * The invoice line editor for the full-page forms.
 *
 * Column headers appear once at the top on desktop instead of being repeated on
 * every row, which is what made the old dialog version feel cramped. Sell
 * quantity is a caption under the quantity rather than its own column, so the
 * table fits beside the totals panel without scrolling sideways. Below lg the
 * same rows render as stacked cards, since this cannot work on a phone.
 */
export function InvoiceItemsTable({
  items, onChange, products, lastRates, partyId, enableCutting = false,
}: Props) {
  const update = (id: string, patch: Partial<LineItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const setProduct = (id: string, product_id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const remembered = lastRates && partyId ? lastRates[`${product_id}:${partyId}`] : undefined;
    const shouldFill = remembered != null && (!it.rate || !it.rateTouched);
    update(id, { product_id, rate: shouldFill ? String(remembered) : it.rate });
  };

  const add = () => onChange([...items, newEmptyItem()]);
  const remove = (id: string) =>
    onChange(items.length === 1 ? [newEmptyItem()] : items.filter((it) => it.id !== id));

  const productSelect = (it: LineItem) => (
    <Select value={it.product_id} onValueChange={(v) => setProduct(it.id, v)}>
      <SelectTrigger className="w-full min-w-0">
        <SelectValue placeholder="Select product" />
      </SelectTrigger>
      <SelectContent>
        {products.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // Only kg is editable, as before. Any grams already on a saved line are kept
  // in state and shown in the caption, rather than being silently zeroed.
  const qtyInput = (it: LineItem) => (
    <div className="flex items-center gap-1.5">
      <Input
        type="number" min="0" step="1" inputMode="numeric"
        value={it.kg}
        onChange={(e) => update(it.id, { kg: e.target.value })}
        placeholder="0"
        className="w-full min-w-0 tabular-nums"
        aria-label="Quantity in kilograms"
      />
      <span className="shrink-0 text-xs text-muted-foreground">kg</span>
    </div>
  );

  const rateInput = (it: LineItem) => (
    <Input
      type="number" step="0.01" min="0" inputMode="decimal"
      value={it.rate}
      onChange={(e) => update(it.id, { rate: e.target.value, rateTouched: true })}
      placeholder="0.00"
      className="w-full min-w-0 text-right tabular-nums"
      aria-label="Rate per kg"
    />
  );

  const cuttingInput = (it: LineItem, over: boolean) => (
    <Input
      type="number" min="0" step="1" inputMode="numeric"
      value={it.cutting_kg ?? ""}
      onChange={(e) => update(it.id, { cutting_kg: e.target.value })}
      placeholder="0"
      className={cn(
        "w-full min-w-0 tabular-nums",
        over && "border-destructive focus-visible:ring-destructive",
      )}
      aria-label="Cutting in kilograms"
    />
  );

  /** Caption under the quantity: what actually gets priced. */
  const qtyCaption = (it: LineItem) => {
    const m = lineMaths(it, enableCutting);
    if (m.cuttingOver) {
      return <span className="text-destructive">Cutting exceeds quantity</span>;
    }
    if (m.cuttingG > 0) return <>Sell {formatKgG(m.sellG) || "0 kg"}</>;
    if (Number(it.g) > 0) return <>{formatKgG(m.grams)}</>;
    return null;
  };

  return (
    <div className="space-y-3">
      {/* ---------- Desktop: one header row, then compact lines ---------- */}
      <div className="hidden overflow-hidden rounded-xl border lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead className="min-w-[10rem]">Product</TableHead>
              <TableHead className="w-[8.5rem]">Quantity</TableHead>
              {enableCutting && <TableHead className="w-[6.5rem]">Cutting (kg)</TableHead>}
              <TableHead className="w-[7rem] text-right">Rate / kg</TableHead>
              <TableHead className="w-[8.5rem] text-right">Line total</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it, i) => {
              const m = lineMaths(it, enableCutting);
              const caption = qtyCaption(it);
              return (
                <TableRow key={it.id} className="hover:bg-transparent">
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell>{productSelect(it)}</TableCell>
                  <TableCell>
                    {qtyInput(it)}
                    {caption && (
                      <div className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground">
                        {caption}
                      </div>
                    )}
                  </TableCell>
                  {enableCutting && <TableCell>{cuttingInput(it, m.cuttingOver)}</TableCell>}
                  <TableCell>{rateInput(it)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                    {formatRate(m.lineTotal)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button" variant="ghost" size="icon"
                      onClick={() => remove(it.id)}
                      aria-label={`Remove line ${i + 1}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ---------- Mobile: one card per line ---------- */}
      <div className="space-y-3 lg:hidden">
        {items.map((it, i) => {
          const m = lineMaths(it, enableCutting);
          const caption = qtyCaption(it);
          return (
            <div key={it.id} className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Item {i + 1}
                </span>
                <Button
                  type="button" variant="ghost" size="icon"
                  onClick={() => remove(it.id)}
                  aria-label={`Remove item ${i + 1}`}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Product</Label>
                  {productSelect(it)}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Quantity</Label>
                    {qtyInput(it)}
                  </div>
                  {enableCutting && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cutting (kg)</Label>
                      {cuttingInput(it, m.cuttingOver)}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Rate / kg</Label>
                    {rateInput(it)}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t pt-2 text-sm">
                  <span className="text-[11px] text-muted-foreground">
                    {caption ?? "Line total"}
                  </span>
                  <span className="font-semibold tabular-nums">{formatRate(m.lineTotal)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button type="button" variant="outline" onClick={add} className="w-full gap-1.5 sm:w-auto">
        <Plus className="h-4 w-4" /> Add item
      </Button>
    </div>
  );
}
