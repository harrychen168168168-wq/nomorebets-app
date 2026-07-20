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
      // Explicit column list, deliberately WITHOUT author_user_id. `select=*` handed the author of
      // every anonymous story to the moderation screen, so display_mode='anonymous' was anonymous
      // to other users but not to the admin. Moderation does not need the id: sanctionStoryAuthor
      // resolves the author server-side from the story row.
      const columns = 'id,source_record_date,display_mode,display_name,gambling_type,title,excerpt,body,status,source,created_at,published_at,reviewed_at,reviewed_by,rejection_reason';
      const rows = await rest('public_stories?select=' + columns + '&status=eq.pending&order=created_at.asc&limit=100');
      return json({ stories: rows });
    }

    if (action === 'listOpenReports') {
      // Same reasoning as above: the moderation UI renders reason/story/detail and never the
      // reporter, so shipping reporter_user_id to a client only creates exposure. If repeat-reporter
      // detection is wanted later it belongs server-side, not as ids handed to the device.
      const rows = await rest('story_reports?select=id,story_id,reason,detail,status,created_at&status=eq.open&order=created_at.asc&limit=100');
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

    // sanctionStoryAuthor resolves the author from the story row server-side, so the client never
    // needs author_user_id in the list payload — that is what lets listPendingStories stop handing
    // out the author of an anonymous story. sanctionUser is kept alive for already-shipped bundles.
    if (action === 'sanctionUser' || action === 'sanctionStoryAuthor') {
      let userId = String(body.userId || '');
      if (action === 'sanctionStoryAuthor') {
        const storyId = String(body.storyId || '');
        if (!storyId) return json({ error: 'missing_story_id' }, 400);
        // Works either side of the story_authors migration: once it has run the id lives in the
        // side table and public_stories.author_user_id is null; before it runs, only the column
        // exists. Checking both means the function can deploy independently of the SQL.
        const stashed = await rest('story_authors?select=author_user_id&story_id=eq.' + encodeURIComponent(storyId) + '&limit=1')
          .catch(() => null);
        userId = String(stashed?.[0]?.author_user_id || '');
        if (!userId) {
          const stories = await rest('public_stories?select=author_user_id&id=eq.' + encodeURIComponent(storyId) + '&limit=1');
          userId = String(stories?.[0]?.author_user_id || '');
        }
        if (!userId) return json({ error: 'story_has_no_author' }, 404);
      }
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

    // Moderators make mistakes and every sanction here was one-way: `blocked` is written with
    // active_until = null, and is_user_sanctioned() treats null as "forever", so a misclick was
    // permanent and only fixable by hand-editing the table.
    //
    // Neither action returns user_id. The moderator identifies a row by level + reason (the reason
    // carries the story title) + date, which is enough to undo their own action without shipping a
    // gambling-recovery user id to a device — same reasoning as listPendingStories above.
    if (action === 'listActiveSanctions') {
      const rows = await rest('user_sanctions?select=id,level,reason,created_at,active_until&order=created_at.desc&limit=100');
      const now = Date.now();
      // Mirrors public.is_user_sanctioned() exactly: only these levels block, and null means forever.
      // Filtering here rather than in the query keeps it away from PostgREST's or/timestamp syntax.
      const active = (Array.isArray(rows) ? rows : []).filter((row: any) =>
        ['mute_7d', 'mute_30d', 'blocked'].includes(String(row.level))
        && (!row.active_until || new Date(row.active_until).getTime() > now));
      return json({ sanctions: active });
    }

    if (action === 'liftSanction') {
      const sanctionId = String(body.sanctionId || '');
      if (!sanctionId) return json({ error: 'missing_sanction_id' }, 400);
      // Expire rather than delete: the moderation trail should keep showing that it happened and
      // that it was undone. is_user_sanctioned() stops matching once active_until is in the past.
      const liftedAt = new Date().toISOString();
      const rows = await rest('user_sanctions?id=eq.' + encodeURIComponent(sanctionId), {
        method: 'PATCH',
        body: JSON.stringify({ active_until: liftedAt }),
      });
      if (!Array.isArray(rows) || !rows.length) return json({ error: 'missing_sanction' }, 404);
      await rest('moderation_logs', {
        method: 'POST',
        body: JSON.stringify({ admin_user_id: adminUserId, action: 'sanction_lifted', target_type: 'user_sanction', target_id: sanctionId, detail: body.reason || '' }),
      });
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (error) {
    console.error('[community-admin]', error);
    return json({ error: error instanceof Error ? error.message : 'server_error' }, 500);
  }
});
