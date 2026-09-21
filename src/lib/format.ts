// Integer formatter (used for totals — rounded, no decimals)
const fmtInt = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// "Clean" formatter — drops trailing zeros: 12 → "12", 12.5 → "12.5"
const fmtClean = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Rounded total with Rs prefix — use for KPI cards & grand totals only. */
export function formatPKR(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return "Rs 0";
  return `Rs ${fmtInt.format(Math.round(n))}`;
}

/** Rounded integer, no currency prefix — for table cells. */
export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return "0";
  return fmtInt.format(Math.round(n));
}

/** Clean number, no trailing zeros, no prefix — for per-kg rates & line totals. */
export function formatRate(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return "0";
  return fmtClean.format(n);
}

const intFmt = new Intl.NumberFormat("en-PK");
export function formatInt(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return intFmt.format(Number.isFinite(n) ? n : 0);
}

const qtyFmt = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 3 });
export function formatQty(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return qtyFmt.format(Number.isFinite(n) ? n : 0);
}

/** Convert kg + gram inputs to whole grams. */
export function kgGramToGrams(kg: number | string | null | undefined, g: number | string | null | undefined): number {
  const k = Math.max(0, Math.floor(Number(kg) || 0));
  const gr = Math.max(0, Math.floor(Number(g) || 0));
  return k * 1000 + gr;
}

/** Split whole grams to { kg, g }. */
export function gramsToKgGram(grams: number | string | null | undefined): { kg: number; g: number } {
  const n = Math.max(0, Math.floor(Number(grams) || 0));
  return { kg: Math.floor(n / 1000), g: n % 1000 };
}

/** Human display like "1 kg 50 g", "750 g", "2 kg". */
export function formatKgG(grams: number | string | null | undefined): string {
  const n = Number(grams);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const { kg, g } = gramsToKgGram(n);
  if (kg && g) return `${kg} kg ${g} g`;
  if (kg) return `${kg} kg`;
  return `${g} g`;
}

/** Rounded whole kg with "kg" suffix — for KPI cards / totals. */
export function formatKg(grams: number | string | null | undefined): string {
  const n = Number(grams);
  if (!Number.isFinite(n) || n <= 0) return "0 kg";
  return `${fmtInt.format(Math.round(n / 1000))} kg`;
}

/** Rate is per Kg. Total = rate * (grams / 1000). */
export function totalFromRatePerKg(ratePerKg: number | string | null | undefined, grams: number | string | null | undefined): number {
  const r = Number(ratePerKg) || 0;
  const g = Number(grams) || 0;
  return Math.round(((r * g) / 1000) * 100) / 100;
}
