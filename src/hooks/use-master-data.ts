import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useActiveList<T = { id: string; name: string }>(table: string, orderBy: string = "name") {
  return useQuery({
    queryKey: [table, "active", orderBy],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(table)
        .select("*")
        .eq("is_active", true)
        .order(orderBy);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function useSuppliers() { return useActiveList<{ id: string; name: string; phone: string | null }>("suppliers"); }
export function useCustomers() { return useActiveList<{ id: string; name: string; phone: string | null }>("customers"); }
export function useProducts() { return useActiveList<{ id: string; name: string }>("products"); }
export function useExpenseCategories() { return useActiveList<{ id: string; name: string }>("expense_categories"); }
export function useBanks() { return useActiveList<{ id: string; bank_name: string; account_title: string }>("banks", "bank_name"); }

/** Map of `${product_id}:${party_type}:${party_id}` -> last rate. */
export function useLastRates(partyType: "supplier" | "customer") {
  return useQuery({
    queryKey: ["product_party_rates", partyType],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_party_rates")
        .select("product_id, party_id, rate")
        .eq("party_type", partyType);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[`${r.product_id}:${r.party_id}`] = Number(r.rate);
      return map;
    },
  });
}
