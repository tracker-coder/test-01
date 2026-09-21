// Simple helper to share text via WhatsApp.
// Opens wa.me with pre-filled text so the user can pick any contact.
export function shareOnWhatsApp(text: string, phone?: string) {
  const base = phone
    ? `https://wa.me/${phone.replace(/[^\d]/g, "")}`
    : "https://wa.me/";
  const url = `${base}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function padRight(s: string, n: number) {
  s = String(s ?? "");
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}
