import { kgGramToGrams, gramsToKgGram, totalFromRatePerKg } from "@/lib/format";

/**
 * One editable line on a sale or purchase invoice.
 *
 * Quantities are held as strings because they are bound to controlled inputs;
 * they are only converted to grams at the boundary (totals and save).
 */
export interface LineItem {
  id: string; // client-side row key, not persisted
  product_id: string;
  kg: string;
  g: string;
  cutting_kg?: string;
  rate: string;
  /** Set once the user edits the rate, so remembered rates stop overwriting it. */
  rateTouched?: boolean;
}

export function newEmptyItem(): LineItem {
  return { id: crypto.randomUUID(), product_id: "", kg: "", g: "", cutting_kg: "", rate: "" };
}

/** Rebuild editable rows from saved sale_items / purchase_items. */
export function itemsFromRows(rows: any[] | undefined): LineItem[] {
  if (!rows || rows.length === 0) return [newEmptyItem()];
  return rows.map((r) => {
    const { kg, g } = gramsToKgGram(r.quantity_g);
    const cuttingKg = Math.floor(Number(r.cutting_g ?? 0) / 1000);
    return {
      id: crypto.randomUUID(),
      product_id: r.product_id,
      kg: String(kg),
      g: String(g),
      cutting_kg: cuttingKg ? String(cuttingKg) : "",
      rate: String(r.rate),
      rateTouched: true,
    };
  });
}

export interface LineMaths {
  grams: number;
  cuttingG: number;
  sellG: number;
  lineTotal: number;
  cuttingOver: boolean;
}

/** Every derived number for one row, in one place, so the table and the totals agree. */
export function lineMaths(item: LineItem, withCutting: boolean): LineMaths {
  const grams = kgGramToGrams(item.kg, item.g);
  const cuttingG = withCutting ? kgGramToGrams(item.cutting_kg ?? "0", "0") : 0;
  const sellG = Math.max(grams - cuttingG, 0);
  return {
    grams,
    cuttingG,
    sellG,
    lineTotal: totalFromRatePerKg(item.rate, sellG),
    cuttingOver: withCutting && cuttingG > grams,
  };
}

export function itemsTotal(items: LineItem[], withCutting: boolean): number {
  return items.reduce((sum, it) => sum + lineMaths(it, withCutting).lineTotal, 0);
}

export function itemsWeight(items: LineItem[], withCutting: boolean): number {
  return items.reduce((sum, it) => sum + lineMaths(it, withCutting).sellG, 0);
}

/** True for a row the user has not started filling in — skipped rather than rejected. */
export function isBlankRow(item: LineItem, withCutting: boolean): boolean {
  const { grams, cuttingG } = lineMaths(item, withCutting);
  return !item.product_id && grams === 0 && !item.rate && !cuttingG;
}

export interface PreparedItem {
  product_id: string;
  quantity_g: number;
  cutting_g?: number;
  rate: number;
}

export function validateItems(
  items: LineItem[],
  opts?: { withCutting?: boolean },
): { ok: boolean; message?: string; prepared?: PreparedItem[] } {
  const withCutting = !!opts?.withCutting;
  const prepared: PreparedItem[] = [];

  for (const it of items) {
    if (isBlankRow(it, withCutting)) continue;
    const { grams, cuttingG } = lineMaths(it, withCutting);
    const rate = Number(it.rate);

    if (!it.product_id) return { ok: false, message: "Every line needs a product" };
    if (grams <= 0) return { ok: false, message: "Every line needs a quantity" };
    if (!rate || rate <= 0) return { ok: false, message: "Every line needs a rate" };
    if (withCutting && cuttingG > grams) return { ok: false, message: "Cutting cannot exceed quantity" };

    prepared.push(
      withCutting
        ? { product_id: it.product_id, quantity_g: grams, cutting_g: cuttingG, rate }
        : { product_id: it.product_id, quantity_g: grams, rate },
    );
  }

  if (!prepared.length) return { ok: false, message: "Add at least one item" };
  return { ok: true, prepared };
}
