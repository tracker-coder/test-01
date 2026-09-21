## Shipping and loading/unloading charges on sales invoices

Add two optional charge fields to a sale invoice that are subtracted from the item total to give a net total.

Example: items 100 − shipping 10 − loading/unloading 20 = net 70.

### What changes

**Sale form (new/edit invoice)**
- Two new numeric inputs: "Shipping charges" and "Loading/unloading charges" (default 0).
- Live summary at the bottom of the form: Items total, minus Shipping, minus Loading/unloading, Net total.

**Sales list**
- The Amount column shows the net total (what is actually receivable/payable in cash).

**Invoice view dialog**
- Shows Items total, Shipping, Loading/unloading, and Net total as separate lines when charges exist.

**WhatsApp share / PDF**
- Charge lines included under the item list before the net total.

### Data and calculation

- Add `shipping_charges` and `loading_charges` (numeric, default 0) to the `sales` table.
- The existing total recalculation trigger becomes:
  `total_amount = sum(line_total) − shipping_charges − loading_charges`,
  and also re-runs when the charge values change on the invoice itself.
- Because cash/bank/credit ledger sync already uses `total_amount`, cash flow, customer statements and dashboard figures automatically reflect the net amount with no extra work.
- Existing invoices get 0 for both charges, so no current figures change.

### Note
Charges are treated as reductions of the sale (as in your example), not as separate expenses. If you'd rather they also appear as expense entries in cash flow, say so and I'll adjust.
