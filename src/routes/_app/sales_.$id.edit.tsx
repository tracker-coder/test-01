import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SaleFormPage } from "@/components/sale-form";
import { RecordLoader } from "@/components/record-loader";

export const Route = createFileRoute("/_app/sales_/$id/edit")({
  head: () => ({ meta: [{ title: "Edit sale — GUL Paper" }] }),
  component: EditSale,
});

function EditSale() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["sale", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sales")
        .select("*, sale_items(id, product_id, quantity_g, cutting_g, rate)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <RecordLoader query={q} backTo="/sales" backLabel="Sales" missingLabel="sale">
      {(row) => <SaleFormPage initial={row} />}
    </RecordLoader>
  );
}
