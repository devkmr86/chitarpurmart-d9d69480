import { supabase } from "@/integrations/supabase/client";

/** Records an admin action in the audit log. Never throws. */
export async function logAdminAction(
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  try {
    const { data } = await supabase.auth.getUser();
    const actorId = data.user?.id;
    if (!actorId) return;
    await supabase.from("audit_logs").insert({
      actor_id: actorId,
      action,
      entity,
      entity_id: entityId,
      details: details as never,
    });
  } catch {
    /* audit logging must never block an admin action */
  }
}