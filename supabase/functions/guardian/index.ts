import { corsHeaders, json, makeCode, readJson, rest } from '../_shared/http.ts';

function requireLocalAuthAllowed() {
  return Deno.env.get('ALLOW_LOCAL_APP_USER_IDS') === 'true';
}

function requireUser(userId: string) {
  if (!userId) return { ok: false, error: 'missing_user_id' };
  if (!requireLocalAuthAllowed()) return { ok: false, error: 'local_user_ids_disabled' };
  return { ok: true, error: '' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await readJson(req);
    const action = String(body.action || '');
    const userId = String(body.userId || '');
    const userCheck = requireUser(userId);
    if (!userCheck.ok) return json({ error: userCheck.error }, 401);

    if (action === 'createInvite') {
      const type = String(body.type || '');
      if (!['family', 'mutual'].includes(type)) return json({ error: 'invalid_invite_type' }, 400);
      const existing = await rest('guardian_links?select=id&type=eq.' + type + '&status=eq.active&or=(owner_user_id.eq.' + encodeURIComponent(userId) + ',member_user_id.eq.' + encodeURIComponent(userId) + ')&limit=1');
      if (existing?.length) return json({ error: 'active_link_exists' }, 409);
      const rows = await rest('guardian_invites', {
        method: 'POST',
        body: JSON.stringify({ code: makeCode(), owner_user_id: userId, type, status: 'active' }),
      });
      return json({ invite: rows?.[0] });
    }

    if (action === 'acceptInvite') {
      const code = String(body.code || '').trim().toUpperCase();
      if (!code) return json({ error: 'missing_invite_code' }, 400);
      const invites = await rest('guardian_invites?select=*&code=eq.' + encodeURIComponent(code) + '&status=eq.active&limit=1');
      const invite = invites?.[0];
      if (!invite) return json({ error: 'invalid_or_expired_invite' }, 404);
      if (invite.owner_user_id === userId) return json({ error: 'cannot_accept_own_invite' }, 400);
      const type = invite.type;
      const existing = await rest('guardian_links?select=id&type=eq.' + type + '&status=eq.active&or=(owner_user_id.eq.' + encodeURIComponent(invite.owner_user_id) + ',member_user_id.eq.' + encodeURIComponent(userId) + ')&limit=1');
      if (existing?.length) return json({ error: 'active_link_exists' }, 409);
      const rows = await rest('guardian_links', {
        method: 'POST',
        body: JSON.stringify({
          type,
          owner_user_id: invite.owner_user_id,
          member_user_id: userId,
          status: 'active',
          share_mood: true,
          share_impulse: true,
          share_today_status: true,
          share_streak: true,
          share_emergency: true,
          ai_quota_group_id: type === 'family' ? invite.owner_user_id : null,
        }),
      });
      await rest('guardian_invites?id=eq.' + invite.id, { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) });
      await rest('app_notifications', {
        method: 'POST',
        body: JSON.stringify({ user_id: invite.owner_user_id, title: '邀请已接受', body: '对方已经加入你的守护关系。', kind: 'guardian_invite_accepted' }),
      });
      return json({ link: rows?.[0] });
    }

    if (action === 'listLinks') {
      const rows = await rest('guardian_links?select=*&status=eq.active&or=(owner_user_id.eq.' + encodeURIComponent(userId) + ',member_user_id.eq.' + encodeURIComponent(userId) + ')&order=created_at.desc&limit=20');
      return json({ links: rows });
    }

    if (action === 'pushStatus') {
      const s = body.status || {};
      await rest('guardian_shared_status?on_conflict=app_user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          app_user_id: userId,
          today_date: String(s.todayDate || ''),
          today_recorded: !!s.todayRecorded,
          today_high_risk: !!s.todayHighRisk,
          mood: s.mood ? String(s.mood).slice(0, 40) : null,
          impulse: Number(s.impulse) || 0,
          streak: Number(s.streak) || 0,
          longest_streak: Number(s.longestStreak) || 0,
          updated_at: new Date().toISOString(),
        }),
      });
      return json({ ok: true });
    }

    if (action === 'getLinkedStatus') {
      const links = await rest('guardian_links?select=*&status=eq.active&or=(owner_user_id.eq.' + encodeURIComponent(userId) + ',member_user_id.eq.' + encodeURIComponent(userId) + ')&order=created_at.desc&limit=20');
      const statuses = [];
      for (const link of links || []) {
        const isOwner = link.owner_user_id === userId;
        const otherUserId = isOwner ? link.member_user_id : link.owner_user_id;
        // Family guardian is one-way: only the owner (the family guardian) may view the
        // protected member's status. The protected member does not see the guardian's data.
        if (link.type === 'family' && !isOwner) {
          statuses.push({ link, viewable: false, status: null });
          continue;
        }
        const rows = await rest('guardian_shared_status?select=*&app_user_id=eq.' + encodeURIComponent(otherUserId) + '&limit=1');
        const raw = Array.isArray(rows) ? rows[0] : null;
        const status = raw
          ? {
              todayDate: raw.today_date || null,
              todayRecorded: link.share_today_status ? !!raw.today_recorded : null,
              todayHighRisk: link.share_emergency ? !!raw.today_high_risk : null,
              mood: link.share_mood ? raw.mood || null : null,
              impulse: link.share_impulse ? Number(raw.impulse) || 0 : null,
              streak: link.share_streak ? Number(raw.streak) || 0 : null,
              longestStreak: link.share_streak ? Number(raw.longest_streak) || 0 : null,
              updatedAt: raw.updated_at || null,
            }
          : null;
        statuses.push({ link, viewable: true, status });
      }
      return json({ statuses });
    }

    if (action === 'cancelLink') {
      const linkId = String(body.linkId || '');
      if (!linkId) return json({ error: 'missing_link_id' }, 400);
      const links = await rest('guardian_links?select=*&id=eq.' + encodeURIComponent(linkId) + '&status=eq.active&limit=1');
      const link = links?.[0];
      if (!link) return json({ error: 'missing_link' }, 404);
      if (link.owner_user_id !== userId && link.member_user_id !== userId) return json({ error: 'not_link_member' }, 403);
      const otherUserId = link.owner_user_id === userId ? link.member_user_id : link.owner_user_id;
      await rest('guardian_links?id=eq.' + encodeURIComponent(linkId), { method: 'PATCH', body: JSON.stringify({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: userId }) });
      await rest('app_notifications', {
        method: 'POST',
        body: JSON.stringify({ user_id: otherUserId, title: '共享已取消', body: '对方已停止与你共享戒赌状态。', kind: 'guardian_cancelled' }),
      });
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (error) {
    console.error('[guardian]', error);
    return json({ error: error instanceof Error ? error.message : 'server_error' }, 500);
  }
});
