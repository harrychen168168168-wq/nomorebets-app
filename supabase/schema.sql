create extension if not exists pgcrypto;

create table if not exists public.public_stories (
  id uuid primary key default gen_random_uuid(),
  source_record_date text,
  author_user_id text not null,
  display_mode text not null check (display_mode in ('anonymous', 'nickname', 'ai', 'system')),
  display_name text not null default '匿名用户',
  gambling_type text not null default 'casino',
  title text not null,
  excerpt text not null,
  body text not null,
  status text not null default 'pending' check (status in ('draft', 'pending', 'approved', 'rejected', 'hidden', 'deleted')),
  source text not null default 'user' check (source in ('user', 'ai', 'system')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  rejection_reason text
);

create table if not exists public.story_reactions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.public_stories(id) on delete cascade,
  user_id text not null,
  reaction text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.story_reports (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.public_stories(id) on delete cascade,
  reporter_user_id text not null,
  reason text not null,
  detail text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create table if not exists public.guardian_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_user_id text not null,
  type text not null check (type in ('family', 'mutual')),
  status text not null default 'active' check (status in ('active', 'accepted', 'cancelled', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('family', 'mutual')),
  owner_user_id text not null,
  member_user_id text not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  ai_quota_group_id text,
  share_mood boolean not null default true,
  share_impulse boolean not null default true,
  share_today_status boolean not null default true,
  share_streak boolean not null default true,
  share_emergency boolean not null default true,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text
);

create table if not exists public.subscription_memberships (
  app_user_id text primary key,
  product_id text,
  plan_type text not null check (plan_type in ('monthly', 'annual', 'mutual', 'unknown')),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  expires_at timestamptz,
  will_renew boolean,
  revenuecat_event_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_quota_groups (
  id text primary key,
  owner_user_id text not null,
  plan_type text not null check (plan_type in ('monthly', 'annual', 'mutual')),
  monthly_limit integer not null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  body text not null,
  kind text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.user_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  level text not null check (level in ('warning', 'mute_7d', 'mute_30d', 'blocked')),
  reason text not null,
  active_until timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.guardian_shared_status (
  app_user_id text primary key,
  today_date text,
  today_recorded boolean not null default false,
  today_high_risk boolean not null default false,
  mood text,
  impulse integer not null default 0,
  streak integer not null default 0,
  longest_streak integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists public_stories_status_published_idx on public.public_stories(status, published_at desc);
create index if not exists story_reports_status_created_idx on public.story_reports(status, created_at asc);
create unique index if not exists guardian_links_active_owner_type_idx on public.guardian_links(type, owner_user_id) where status = 'active';
create unique index if not exists guardian_links_active_member_type_idx on public.guardian_links(type, member_user_id) where status = 'active';
create unique index if not exists story_reactions_unique_idx on public.story_reactions(story_id, user_id, reaction);

alter table public.public_stories enable row level security;
alter table public.story_reactions enable row level security;
alter table public.story_reports enable row level security;
alter table public.guardian_invites enable row level security;
alter table public.guardian_links enable row level security;
alter table public.subscription_memberships enable row level security;
alter table public.ai_quota_groups enable row level security;
alter table public.app_notifications enable row level security;
alter table public.user_sanctions enable row level security;
alter table public.moderation_logs enable row level security;
alter table public.guardian_shared_status enable row level security;

drop policy if exists "approved stories are public" on public.public_stories;
drop policy if exists "users can submit pending stories" on public.public_stories;
drop policy if exists "users can add reactions" on public.story_reactions;
drop policy if exists "users can report stories" on public.story_reports;
drop policy if exists "users can create guardian invites" on public.guardian_invites;
drop policy if exists "active invite lookup by code" on public.guardian_invites;
drop policy if exists "users can accept guardian links" on public.guardian_links;

-- SECURITY DEFINER so the insert policy can check sanctions even though the anon role has no
-- SELECT access to user_sanctions. Without this the sanction block is never enforced.
create or replace function public.is_user_sanctioned(uid text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_sanctions s
    where s.user_id = uid
      and s.level in ('mute_7d', 'mute_30d', 'blocked')
      and (s.active_until is null or s.active_until > now())
  );
$$;

revoke all on function public.is_user_sanctioned(text) from public;
grant execute on function public.is_user_sanctioned(text) to anon, authenticated;

create policy "approved stories are public" on public.public_stories
  for select using (status = 'approved');

create policy "users can submit pending stories" on public.public_stories
  for insert with check (
    status = 'pending'
    and source = 'user'
    and not public.is_user_sanctioned(author_user_id)
  );

create policy "users can add reactions" on public.story_reactions
  for insert with check (true);

create policy "users can report stories" on public.story_reports
  for insert with check (true);

-- Admin review, sanctions, report resolution, and secure guardian dashboards should
-- move to Supabase Edge Functions or a server using the service role key before launch.
-- Do not expose the service role key inside the Expo app.
