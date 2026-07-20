-- 把公开故事的作者 id 从 public_stories 挪进一张只有 service_role 能读的旁表。
--
-- 为什么:public_stories 的 author_user_id 对任何持有 anon key 的人可读(anon key 就编译在已
-- 发布的 App 包里)。它不是姓名——profiles / guardian_shared_status 都有 RLS 挡着——但它是个
-- 稳定标识符,能把同一个人的多篇"匿名"自白串成一串,而这正是匿名要防的事。
--
-- 为什么用触发器而不是改客户端:客户端是直接 INSERT 到 public_stories 的,而线上还有大量 1.1.0
-- 用户。触发器在写入那一刻就把作者挪走并把列置空,所以老客户端不用更新、也不会因为 SELECT *
-- 少了列或没权限而报错——它们只会读到 NULL。
--
-- ⚠️ 在 Supabase SQL Editor 里执行。执行前建议先跑最下面那段"执行前核对"。
-- ⚠️ 执行后请立刻做一次冒烟测试:发一条新故事 → 管理台应仍能对它执行"警告"。

-- 1) 旁表:默认拒绝一切。不建任何 policy,anon / authenticated 就都读不到;
--    边缘函数用 service_role,不受 RLS 约束。
create table if not exists public.story_authors (
  story_id uuid primary key references public.public_stories(id) on delete cascade,
  author_user_id text not null,
  created_at timestamptz not null default now()
);

alter table public.story_authors enable row level security;
revoke all on public.story_authors from anon, authenticated;

-- 2) 写入时自动挪走作者。SECURITY DEFINER 才能写这张对调用者不可见的表。
create or replace function public.stash_story_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_user_id is not null then
    insert into public.story_authors (story_id, author_user_id)
    values (new.id, new.author_user_id)
    on conflict (story_id) do update set author_user_id = excluded.author_user_id;
    new.author_user_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists stash_story_author_before_insert on public.public_stories;
create trigger stash_story_author_before_insert
before insert on public.public_stories
for each row execute function public.stash_story_author();

-- 3) 回填历史故事,然后清空明文列。顺序不能反:先备份再清。
insert into public.story_authors (story_id, author_user_id)
select id, author_user_id
from public.public_stories
where author_user_id is not null
on conflict (story_id) do nothing;

update public.public_stories
set author_user_id = null
where author_user_id is not null;

-- ── 执行前核对(先单独跑这段看数字对不对) ──────────────────────────────
-- select count(*) as 有作者的故事 from public.public_stories where author_user_id is not null;
--
-- ── 执行后验收 ────────────────────────────────────────────────────
-- select count(*) as 应为0 from public.public_stories where author_user_id is not null;
-- select count(*) as 应等于上面那个数 from public.story_authors;
-- 再用 anon key 打一次,author_user_id 应全是 null:
--   curl "$SUPABASE_URL/rest/v1/public_stories?select=author_user_id&status=eq.approved" \
--        -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
--
-- ── 回滚 ──────────────────────────────────────────────────────────
-- drop trigger if exists stash_story_author_before_insert on public.public_stories;
-- update public.public_stories p set author_user_id = a.author_user_id
--   from public.story_authors a where a.story_id = p.id;
-- (旁表可以留着,它不影响任何读取路径)
