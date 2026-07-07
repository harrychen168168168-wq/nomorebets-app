import { corsHeaders, json, readJson, requireAdmin, rest } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = await requireAdmin(req);
  if (!admin.ok) return json({ error: admin.error }, admin.status);

  try {
    const body = await readJson(req);
    const action = String(body.action || '');
    // Trust the server-verified admin identity, not whatever the client claims.
    const adminUserId = admin.userId || String(body.adminUserId || 'admin');

    if (action === 'listPendingStories') {
      const rows = await rest('public_stories?select=*&status=eq.pending&order=created_at.asc&limit=100');
      return json({ stories: rows });
    }

    if (action === 'listOpenReports') {
      const rows = await rest('story_reports?select=*&status=eq.open&order=created_at.asc&limit=100');
      return json({ reports: rows });
    }

    if (action === 'moderateStory') {
      const storyId = String(body.storyId || '');
      const status = String(body.status || '');
      if (!storyId || !['approved', 'rejected', 'hidden', 'deleted'].includes(status)) return json({ error: 'invalid_story_or_status' }, 400);
      const patch: Record<string, string> = {
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId,
      };
      if (status === 'approved') patch.published_at = new Date().toISOString();
      if (body.reason) patch.rejection_reason = String(body.reason);
      await rest('public_stories?id=eq.' + encodeURIComponent(storyId), { method: 'PATCH', body: JSON.stringify(patch) });
      await rest('moderation_logs', {
        method: 'POST',
        body: JSON.stringify({ admin_user_id: adminUserId, action: 'story_' + status, target_type: 'public_story', target_id: storyId, detail: body.reason || '' }),
      });
      return json({ ok: true });
    }

    if (action === 'resolveReport') {
      const reportId = String(body.reportId || '');
      const status = String(body.status || '');
      if (!reportId || !['resolved', 'dismissed'].includes(status)) return json({ error: 'invalid_report_or_status' }, 400);
      await rest('story_reports?id=eq.' + encodeURIComponent(reportId), {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewed_at: new Date().toISOString(), reviewed_by: adminUserId }),
      });
      await rest('moderation_logs', {
        method: 'POST',
        body: JSON.stringify({ admin_user_id: adminUserId, action: 'report_' + status, target_type: 'story_report', target_id: reportId, detail: '' }),
      });
      return json({ ok: true });
    }

    if (action === 'sanctionUser') {
      const userId = String(body.userId || '');
      const level = String(body.level || '');
      const reason = String(body.reason || '');
      if (!userId || !['warning', 'mute_7d', 'mute_30d', 'blocked'].includes(level) || !reason) return json({ error: 'invalid_sanction' }, 400);
      const activeUntil = level === 'mute_7d'
        ? new Date(Date.now() + 7 * 86400000).toISOString()
        : level === 'mute_30d'
          ? new Date(Date.now() + 30 * 86400000).toISOString()
          : null;
      const rows = await rest('user_sanctions', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, level, reason, active_until: activeUntil, created_by: adminUserId }),
      });
      await rest('moderation_logs', {
        method: 'POST',
        body: JSON.stringify({ admin_user_id: adminUserId, action: 'sanction_' + level, target_type: 'user', target_id: userId, detail: reason }),
      });
      return json({ sanction: rows?.[0] });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (error) {
    console.error('[community-admin]', error);
    return json({ error: error instanceof Error ? error.message : 'server_error' }, 500);
  }
});
