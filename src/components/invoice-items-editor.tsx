import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KgGramInput } from "@/components/kg-gram-input";
import { Plus, Trash2 } from "lucide-react";
import { formatPKR, formatRate, formatKgG, kgGramToGrams, totalFromRatePerKg } from "@/lib/format";

export interface LineItem {
  id: string; // client-side row key
  product_id: string;
  kg: string;
  g: string;
  cutting_kg?: string;
  rate: string;
  rateTouched?: boolean;
}

export function newEmptyItem(): LineItem {
  return { id: crypto.randomUUID(), product_id: "", kg: "", g: "", cutting_kg: "", rate: "" };
}

interface Props {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  products: { id: string; name: string }[];
  lastRates?: Record<string, number>; // key = `${product_id}:${party_id}`
  partyId: string;
  enableCutting?: boolean;
}

export function InvoiceItemsEditor({ items, onChange, products, lastRates, partyId, enableCutting }: Props) {
  const totalGrand = useMemo(
    () => items.reduce((s, it) => {
      const grams = kgGramToGrams(it.kg, it.g);
      const cuttingG = enableCutting ? kgGramToGrams(it.cutting_kg ?? "0", "0") : 0;
      const sellG = Math.max(grams - cuttingG, 0);
      return s + totalFromRatePerKg(it.rate, sellG);
    }, 0),
    [items, enableCutting],
  );

  const update = (id: string, patch: Partial<LineItem>) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const setProduct = (id: string, product_id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const rememberedRate = lastRates && partyId ? lastRates[`${product_id}:${partyId}`] : undefined;
    const shouldFill = rememberedRate != null && (!it.rate || !it.rateTouched);
    update(id, { product_id, rate: shouldFill ? String(rememberedRate) : it.rate });
  };

  const add = () => onChange([...items, newEmptyItem()]);
  const remove = (id: string) => onChange(items.length === 1 ? [newEmptyItem()] : items.filter((it) => it.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Items</Label>
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Add item
        </Button>
      </div>
      <div className="rounded-lg border bg-muted/30 divide-y">
        {items.map((it) => {
          const grams = kgGramToGrams(it.kg, it.g);
          const cuttingG = enableCutting ? kgGramToGrams(it.cutting_kg ?? "0", "0") : 0;
          const sellG = Math.max(grams - cuttingG, 0);
          const lineTotal = totalFromRatePerKg(it.rate, sellG);
          const cuttingOver = enableCutting && cuttingG > grams;
          return (
            <div key={it.id} className="grid grid-cols-12 gap-2 p-2 items-end">
              <div className="col-span-12 sm:col-span-3 min-w-0">
                <Label className="text-xs text-muted-foreground">Product</Label>
                <Select value={it.product_id} onValueChange={(v) => setProduct(it.id, v)}>
                  <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className={"min-w-0 " + (enableCutting ? "col-span-3 sm:col-span-2" : "col-span-12 sm:col-span-4")}>
                <KgGramInput label="Qty" kg={it.kg} g={it.g} onChange={(kg, g) => update(it.id, { kg, g })} />
              </div>
              {enableCutting && (
                <>
                  <div className="col-span-3 sm:col-span-2 min-w-0">
                    <Label className="text-xs text-muted-foreground truncate">Cutting (kg)</Label>
                    <Input
                      type="number" min="0" step="1" inputMode="numeric"
                      value={it.cutting_kg ?? ""}
                      onChange={(e) => update(it.id, { cutting_kg: e.target.value })}
                      placeholder="0"
                      className={"w-full min-w-0 " + (cuttingOver ? "border-destructive" : "")}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2 min-w-0">
                    <Label className="text-xs text-muted-foreground truncate">Sell qty</Label>
                    <Input
                      readOnly
                      value={formatKgG(sellG) || "0 kg"}
                      className="w-full min-w-0 bg-muted/50 tabular-nums"
                    />
                  </div>
                </>
              )}
              <div className={"min-w-0 " + (enableCutting ? "col-span-3 sm:col-span-1" : "col-span-4 sm:col-span-2")}>
                <Label className="text-xs text-muted-foreground truncate">Rate/kg</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={it.rate}
                  onChange={(e) => update(it.id, { rate: e.target.value, rateTouched: true })}
                  placeholder="0.00"
                  className="w-full min-w-0"
                />
              </div>
              <div className={"text-right min-w-0 " + (enableCutting ? "col-span-10 sm:col-span-1" : "col-span-6 sm:col-span-2")}>
                <Label className="text-xs text-muted-foreground">Line</Label>
                <div className="h-9 flex items-center justify-end text-sm tabular-nums font-medium truncate">{formatRate(lineTotal)}</div>
              </div>
              <div className="col-span-2 sm:col-span-1 flex sm:justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(it.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end pt-1 text-sm">
        <div className="rounded-md bg-primary/10 px-3 py-1.5">
          <span className="text-muted-foreground">Invoice total: </span>
          <span className="font-semibold tabular-nums">{formatPKR(totalGrand)}</span>
        </div>
      </div>
    </div>
  );
}

export function validateItems(
  items: LineItem[],
  opts?: { withCutting?: boolean },
): { ok: boolean; message?: string; prepared?: { product_id: string; quantity_g: number; cutting_g?: number; rate: number }[] } {
  const withCutting = !!opts?.withCutting;
  const prepared: { product_id: string; quantity_g: number; cutting_g?: number; rate: number }[] = [];
  for (const it of items) {
    const grams = kgGramToGrams(it.kg, it.g);
    const cuttingG = withCutting ? kgGramToGrams(it.cutting_kg ?? "0", "0") : 0;
    const rate = Number(it.rate);
    if (!it.product_id && grams === 0 && !it.rate && !cuttingG) continue; // skip empty row
    if (!it.product_id) return { ok: false, message: "Every line needs a product" };
    if (grams <= 0) return { ok: false, message: "Every line needs a quantity" };
    if (!rate || rate <= 0) return { ok: false, message: "Every line needs a rate" };
    if (withCutting && cuttingG > grams) return { ok: false, message: "Cutting cannot exceed quantity" };
    prepared.push(withCutting ? { product_id: it.product_id, quantity_g: grams, cutting_g: cuttingG, rate } : { product_id: it.product_id, quantity_g: grams, rate });
  }
  if (!prepared.length) return { ok: false, message: "Add at least one item" };
  return { ok: true, prepared };
}
