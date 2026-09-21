## Fix: long invoice dialogs can't scroll to the Save button

Confirmed cause: the shared dialog container (`src/components/ui/dialog.tsx`) has no height limit and no scrolling. When a sale invoice has several item rows plus charges and notes, the form grows taller than the screen, so the bottom (including Save) is cut off with no way to scroll.

### What changes

- Cap dialog height at about 90% of the screen and let its content area scroll vertically. This applies everywhere dialogs are used (sales, purchases, expenses, master data), so any tall form becomes scrollable.
- Keep the dialog title fixed at the top so the header doesn't scroll away, and keep the close button reachable.
- Keep the Save/Cancel row visible at the bottom of the sale form (sticky footer) so it's always reachable while scrolling the items.

### Technical notes

- `DialogContent`: add `max-h-[90dvh]` plus internal flex layout with an `overflow-y-auto` body wrapper (no layout change for short dialogs).
- Sale/edit form in `src/routes/_app/sales.tsx`: make the action button row sticky to the bottom of the scroll area with a background so it doesn't overlap fields.
- No data, calculation, or backend changes.
