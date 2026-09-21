import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  head: string[];
  body: (string | number)[][];
  /** Column indexes that should be right aligned (numbers). */
  numericColumns?: number[];
  /** Rendered as bold summary lines under the table. */
  totals?: { label: string; value: string }[];
  /** Extra tables rendered below the main table, each with its own heading. */
  sections?: {
    title: string;
    head: string[];
    body: (string | number)[][];
    numericColumns?: number[];
  }[];
}

export function buildReportPdf(o: PdfReportOptions): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("GUL Paper", 40, 46);

  doc.setFontSize(13);
  doc.text(o.title, 40, 68);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  if (o.subtitle) doc.text(o.subtitle, 40, 84);
  doc.text(new Date().toLocaleString(), pageWidth - 40, 46, { align: "right" });
  doc.setTextColor(0);

  const columnStyles: Record<number, any> = {};
  for (const i of o.numericColumns ?? []) columnStyles[i] = { halign: "right" };

  autoTable(doc, {
    startY: o.subtitle ? 98 : 84,
    head: [o.head],
    body: o.body.length ? o.body.map((r) => r.map((c) => String(c ?? ""))) : [o.head.map((_, i) => (i === 0 ? "No records" : ""))],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles,
    margin: { left: 40, right: 40 },
  });

  let y = ((doc as any).lastAutoTable?.finalY ?? 120) + 22;

  for (const s of o.sections ?? []) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(s.title, 40, y);
    const sColumnStyles: Record<number, any> = {};
    for (const i of s.numericColumns ?? []) sColumnStyles[i] = { halign: "right" };
    autoTable(doc, {
      startY: y + 8,
      head: [s.head],
      body: s.body.map((r) => r.map((c) => String(c ?? ""))),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: sColumnStyles,
      margin: { left: 40, right: 40 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 22;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  for (const t of o.totals ?? []) {
    doc.text(t.label, 40, y);
    doc.text(t.value, pageWidth - 40, y, { align: "right" });
    y += 16;
  }
  return doc;
}

/**
 * Generates the PDF and hands it to the device share sheet (WhatsApp, email…).
 * Falls back to downloading the file and opening WhatsApp with a note when the
 * browser cannot share files (most desktop browsers).
 */
export async function shareReportPdf(fileName: string, o: PdfReportOptions, waText?: string) {
  const doc = buildReportPdf(o);
  const blob = doc.output("blob");
  const file = new File([blob], fileName, { type: "application/pdf" });

  const nav: any = typeof navigator !== "undefined" ? navigator : undefined;
  if (nav?.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: o.title, text: o.subtitle ?? o.title });
      return "shared" as const;
    } catch (e: any) {
      if (e?.name === "AbortError") return "cancelled" as const;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  if (waText) {
    window.open(`https://wa.me/?text=${encodeURIComponent(waText)}`, "_blank", "noopener,noreferrer");
  }
  return "downloaded" as const;
}
