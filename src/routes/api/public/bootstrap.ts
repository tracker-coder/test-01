import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * One-shot first-run bootstrap.
 *
 * Creates the very first user (who the `handle_new_user` trigger automatically
 * makes an admin). Refuses to run once any profile exists, so it is inert
 * after the first use and cannot be used to create additional users.
 */
export const Route = createFileRoute("/api/public/bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Gate: only when the app has no users yet.
        const { count } = await supabaseAdmin
          .from("profiles")
          .select("*", { count: "exact", head: true });
        if ((count ?? 0) > 0) {
          return new Response("Bootstrap already complete", { status: 403 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }
        const parsed = z
          .object({
            email: z.string().trim().email(),
            password: z.string().min(8, "Password must be at least 8 characters"),
            full_name: z.string().trim().optional(),
          })
          .safeParse(body);
        if (!parsed.success) {
          return Response.json(parsed.error.flatten(), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: parsed.data.email,
          password: parsed.data.password,
          email_confirm: true,
          user_metadata: { full_name: parsed.data.full_name },
        });
        if (error) return new Response(error.message, { status: 400 });

        return Response.json({ ok: true, user_id: data.user.id });
      },
    },
  },
});
