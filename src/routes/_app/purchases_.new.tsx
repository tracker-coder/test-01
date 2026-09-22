import { createFileRoute } from "@tanstack/react-router";
import { PurchaseFormPage } from "@/components/purchase-form";

export const Route = createFileRoute("/_app/purchases_/new")({
  head: () => ({ meta: [{ title: "New purchase — GUL Paper" }] }),
  component: () => <PurchaseFormPage />,
});
