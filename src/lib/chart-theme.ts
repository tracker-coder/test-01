/**
 * Shared Recharts styling.
 *
 * Recharts writes inline styles and SVG presentation attributes, so it cannot
 * pick up Tailwind classes — it has to be handed the CSS custom properties
 * directly. Note these are `var(--token)`, never `hsl(var(--token))`: the tokens
 * in styles.css are oklch values, and wrapping them in hsl() produces an
 * invalid color that silently renders as black.
 */

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

/** Keeps the tooltip readable in dark mode, where the default is white on white. */
export const chartTooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.6rem",
  boxShadow: "var(--shadow-md)",
  color: "var(--popover-foreground)",
  fontSize: "12px",
} as const;

export const chartAxis = {
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  stroke: "var(--muted-foreground)",
} as const;

export const chartGrid = {
  strokeDasharray: "3 3",
  vertical: false,
  stroke: "var(--border)",
} as const;

export const chartLegend = {
  iconType: "circle",
  iconSize: 8,
  wrapperStyle: { fontSize: 12, paddingTop: 8 },
} as const;

export const chartMargin = { top: 4, right: 4, bottom: 0, left: -8 } as const;

/** Compact axis labels: 1.2M rather than 1,200,000. */
export const compactNumber = (v: number) =>
  new Intl.NumberFormat("en-PK", { notation: "compact" }).format(v);
