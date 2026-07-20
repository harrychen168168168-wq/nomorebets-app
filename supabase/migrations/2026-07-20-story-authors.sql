-- 把公开故事的作者 id 从 public_stories 挪进一张只有 service_role 能读的旁表。
--
-- 为什么:public_stories.author_user_id 对任何持 anon key 的人可读(key 就编译在已发布的 App
-- 包里)。它不是姓名——profiles / guardian_shared_status 都有 RLS 挡着——但它是个稳定标识符,
-- 能把同一个人的多篇"匿名"自白串成一串,而这正是匿名要防的事。
--
-- 为什么用触发器而不是改客户端:客户端直接 INSERT public_stories,而线上还有大量 1.1.0 用户。
-- 触发器在写入那一刻就把作者挪走并把列置空,老客户端不用更新、也不会因为列消失或没权限而
-- 报错,只会读到 NULL。
--
-- ⚠️ 这个脚本的第一版有两处致命缺陷,已修正,记在这里以免有人"简化"回去:
--    (1) author_user_id 原本是 NOT NULL,直接 UPDATE ... = null 会报错 → 下面先 DROP NOT NULL。
--    (2) 投稿的 RLS 策略里有 `not public.is_user_sanctioned(author_user_id)`,而 WITH CHECK 在
--        BEFORE 触发器**之后**求值。触发器一旦把该列置空,is_user_sanctioned(null) 匹配不到任何
--        行、恒返回 false,于是**所有被封禁的人都能重新发帖,制裁全面失效**。
--        因此制裁校验必须搬进触发器、在置空之前执行,策略里那一条同时移除。
--
-- ⚠️ 在 Supabase SQL Editor 里整段执行(已包裹事务,失败会整体回滚)。
-- ⚠️ 执行后必须做两个冒烟测试,见文件末尾。

begin;

-- 0) 允许置空。
alter table public.public_stories alter column author_user_id drop not null;

-- 1) 旁表:默认拒绝一切。不建任何 policy,anon / authenticated 就都读不到;
--    边缘函数用 service_role,不受 RLS 约束。
-- 外键必须 DEFERRABLE INITIALLY DEFERRED:下面那个触发器是 BEFORE INSERT,它往这张表写入时
-- public_stories 的那一行还没落地,立即校验的外键会必然失败 —— 后果是**所有新投稿被拒**。
-- 延迟到 COMMIT 校验时父行已存在,既能通过,又保留引用完整性与 ON DELETE CASCADE。
-- (这一条是实测踩出来的:第一版用了普通外键,回归测试里插入直接报 story_authors_story_id_fkey。)
create table if not exists public.story_authors (
  story_id uuid primary key,
  author_user_id text not null,
  created_at timestamptz not null default now(),
  constraint story_authors_story_id_fkey foreign key (story_id)
    references public.public_stories(id) on delete cascade
    deferrable initially deferred
);

-- 已存在的表(比如按第一版脚本建过)也要把约束换成延迟校验。
alter table public.story_authors drop constraint if exists story_authors_story_id_fkey;
alter table public.story_authors
  add constraint story_authors_story_id_fkey foreign key (story_id)
  references public.public_stories(id) on delete cascade
  deferrable initially deferred;

alter table public.story_authors enable row level security;
revoke all on public.story_authors from anon, authenticated;

-- 2) 写入时:先挡住被制裁的人(原本由 RLS 策略负责,见上文缺陷 2),再把作者挪走并置空。
--    SECURITY DEFINER 才能写这张对调用者不可见的表。
create or replace function public.stash_story_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_user_id is not null then
    if public.is_user_sanctioned(new.author_user_id) then
      raise exception 'user_sanctioned' using errcode = '42501';
    end if;
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

-- 3) 策略里移除对 author_user_id 的依赖(制裁校验已搬进触发器)。
drop policy if exists "users can submit pending stories" on public.public_stories;
create policy "users can submit pending stories" on public.public_stories
  for insert with check (
    status = 'pending'
    and source = 'user'
  );

-- 4) 回填历史故事,然后清空明文列。顺序不能反:先备份再清。
insert into public.story_authors (story_id, author_user_id)
select id, author_user_id
from public.public_stories
where author_user_id is not null
on conflict (story_id) do nothing;

update public.public_stories
set author_user_id = null
where author_user_id is not null;

commit;

-- ── 执行前核对(先单独跑这句,记下数字) ─────────────────────────────
-- select count(*) as 有作者的故事 from public.public_stories where author_user_id is not null;
--
-- ── 执行后验收(SQL) ───────────────────────────────────────────────
-- select count(*) as 应为0 from public.public_stories where author_user_id is not null;
-- select count(*) as 应等于执行前那个数 from public.story_authors;
--
-- ── 状态:已于 2026-07-20 对生产库执行并验收通过 ──────────────────
-- 执行前 2 篇故事均带作者;执行后 public_stories 中为 0、story_authors 中为 2;列已可空;
-- 触发器已装;策略已不再依赖 author_user_id。匿名 key 读 author_user_id 得到 null,读
-- story_authors 得 42501;老客户端 select=* 与新客户端列清单均 200。回归测试(事务内 rollback)
-- 确认:被封禁用户投稿失败、正常用户投稿成功且作者自动入旁表。
--
-- ── 执行后冒烟测试(必做,两项) ─────────────────────────────────────
-- A. 在 App 里发一条新故事 → 管理台应能看到它,并能对它执行「禁言7天」。
--    (验证 sanctionStoryAuthor 能从旁表反查到作者。)
-- B. 用被禁言的账号再发一条 → 应当失败。
--    (验证制裁校验搬进触发器后仍然生效 —— 这是上文缺陷 2 的回归测试,别跳过。)
--
-- ── 回滚 ──────────────────────────────────────────────────────────
-- begin;
-- drop trigger if exists stash_story_author_before_insert on public.public_stories;
-- drop function if exists public.stash_story_author();
-- update public.public_stories p set author_user_id = a.author_user_id
--   from public.story_authors a where a.story_id = p.id;
-- alter table public.public_stories alter column author_user_id set not null;
-- drop policy if exists "users can submit pending stories" on public.public_stories;
-- create policy "users can submit pending stories" on public.public_stories
--   for insert with check (
--     status = 'pending' and source = 'user'
--     and not public.is_user_sanctioned(author_user_id)
--   );
-- commit;
-- (旁表可以留着,它不影响任何读取路径)
