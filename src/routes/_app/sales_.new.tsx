import { createFileRoute } from "@tanstack/react-router";
import { SaleFormPage } from "@/components/sale-form";

export const Route = createFileRoute("/_app/sales_/new")({
  head: () => ({ meta: [{ title: "New sale — GUL Paper" }] }),
  component: () => <SaleFormPage />,
});
