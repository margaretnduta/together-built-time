import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Fully deletes the calling user's account.
 *
 * Steps (in order):
 *  1. Wipe the user's personal data via the SECURITY DEFINER RPC
 *     `public.delete_my_account_data()`. That call also dissolves any
 *     active partnership so the partner is automatically returned to the
 *     pre-partnership onboarding state.
 *  2. Delete the auth user via the admin client.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Wipe app data + dissolve partnership (runs as the user, RLS-safe).
    const { error: wipeErr } = await supabase.rpc("delete_my_account_data");
    if (wipeErr) {
      throw new Error(wipeErr.message || "Could not delete account data");
    }

    // 2. Delete the auth user (admin only — service role).
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) {
      throw new Error(authErr.message || "Could not remove your login");
    }

    return { ok: true as const };
  });
