// Shared helper for writing rich audit log entries from edge functions.
// Uses service role to bypass RLS. Never throws — logging must never break the
// main flow. Categories mirror the sidebar so the audit panel can filter by area.

export type AuditCategory =
  | 'whatsapp'
  | 'broadcasts'
  | 'leads'
  | 'commissions'
  | 'corban'
  | 'contracts'
  | 'simulator'
  | 'hr'
  | 'users'
  | 'settings'
  | 'system';

export interface AuditLogInput {
  /** Action key (snake_case). Eg: v8_get_configs, hr_notification_sent */
  action: string;
  /** Module/category (mirrors sidebar) */
  category: AuditCategory;
  /** Whether the operation succeeded */
  success: boolean;
  /** Caller user id (auth.uid). Optional for system/cron actions */
  userId?: string | null;
  userEmail?: string | null;
  /** Logical table or domain affected (eg "v8_configs_cache", "broadcast_campaigns") */
  targetTable?: string | null;
  /** Affected entity id (campaign_id, user_id, etc) */
  targetId?: string | null;
  /** Free-form payload — sent params, response status, error message, counters */
  details?: Record<string, unknown>;
}

/**
 * Write a structured row to public.audit_logs using the service role client.
 * Silently swallows any error — auditing must never block the primary flow.
 */
export async function writeAuditLog(
  supabaseAdmin: any,
  input: AuditLogInput,
): Promise<void> {
  try {
    const enrichedDetails = {
      category: input.category,
      success: input.success,
      ...(input.details || {}),
    };
    await supabaseAdmin.from('audit_logs').insert({
      user_id: input.userId ?? null,
      user_email: input.userEmail ?? null,
      action: input.action,
      target_table: input.targetTable ?? null,
      target_id: input.targetId ?? null,
      details: enrichedDetails,
    });
  } catch (err) {
    // Never throw from a logger.
    console.error('[auditLog] failed to write entry:', (err as Error)?.message);
  }
}
