import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PurchaseFormPage } from "@/components/purchase-form";
import { RecordLoader } from "@/components/record-loader";

export const Route = createFileRoute("/_app/purchases_/$id/edit")({
  head: () => ({ meta: [{ title: "Edit purchase — GUL Paper" }] }),
  component: EditPurchase,
});

function EditPurchase() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["purchase", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("purchases")
        .select("*, purchase_items(id, product_id, quantity_g, rate)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <RecordLoader query={q} backTo="/purchases" backLabel="Purchases" missingLabel="purchase">
      {(row) => <PurchaseFormPage initial={row} />}
    </RecordLoader>
  );
}
