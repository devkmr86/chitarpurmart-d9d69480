import { createFileRoute } from "@tanstack/react-router";

const ADMIN_PHONE = "7643840194";
const ADMIN_PASSWORD = "Admin@Suraj1992";

export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: existing } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("role", "ADMIN")
          .limit(1);
        if (existing && existing.length > 0) {
          return Response.json({ ok: true, created: false });
        }

        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: `${ADMIN_PHONE}@mannu.local`,
          password: ADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: { phone: ADMIN_PHONE, full_name: "Suraj Kumar" },
        });
        if (error || !created.user) {
          return Response.json({ ok: false, error: error?.message }, { status: 500 });
        }

        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: created.user.id, role: "ADMIN" }, { onConflict: "user_id,role" });

        return Response.json({ ok: true, created: true });
      },
    },
  },
});
