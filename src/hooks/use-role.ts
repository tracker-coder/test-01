import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./use-session";

export type AppRole = "admin" | "staff";

export function useMyRoles() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function useIsAdmin() {
  const { data: roles } = useMyRoles();
  return (roles ?? []).includes("admin");
}
