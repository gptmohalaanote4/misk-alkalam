-- ════════════════════════════════════════════════════════════════
--  حكمة — مخطط قاعدة البيانات (Supabase / PostgreSQL)
--  نفّذ هذا الملف كاملاً في: Supabase Dashboard → SQL Editor
--
--  قاعدة الصلاحيات:
--    • القراءة متاحة للجميع (المنشور فقط).
--    • الكتابة — إضافة عالم، إضافة مصدر غير تراث، إضافة محتوى —
--      مقصورة على الأدمن، ومفروضة هنا بـ RLS لا في التطبيق.
-- ════════════════════════════════════════════════════════════════

-- ─────────────── ١) الحسابات والأدوار ───────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

-- كل مستخدم جديد يبدأ بدور user؛ الترقية إلى admin يدوية (انظر آخر الملف).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- دالة فحص الأدمن. security definer حتى لا تصطدم بـ RLS على profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ─────────────── ٢) المصادر ───────────────
-- «موقع تراث» مصدر مدمج. أي مصدر آخر يضيفه الأدمن وحده.

create table if not exists public.sources (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  kind        text not null default 'external' check (kind in ('turath', 'external')),
  base_url    text,
  note        text,
  is_builtin  boolean not null default false,
  is_default  boolean not null default false,
  is_active   boolean not null default true,
  sort_order  integer not null default 100,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now()
);

-- مصدر افتراضي واحد فقط.
create unique index if not exists sources_single_default
  on public.sources (is_default) where is_default;

-- ─────────────── ٣) العلماء ───────────────

create table if not exists public.scholars (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  full_name        text,
  era              text,
  death_year_hijri integer,
  bio              text,
  is_active        boolean not null default true,
  sort_order       integer not null default 100,
  created_by       uuid references auth.users (id),
  created_at       timestamptz not null default now()
);

-- ─────────────── ٤) المقولات ───────────────

create table if not exists public.quotes (
  id                     uuid primary key default gen_random_uuid(),
  scholar_id             uuid not null references public.scholars (id) on delete cascade,
  source_id              uuid not null references public.sources (id),
  -- النوع الفرعي: قولٌ للعالم، أو خبرٌ عن صالح من كتب السِّيَر. كلاهما في قسم
  -- المقولات، ويختلفان في العرض وحده («من سير الصالحين»).
  genre                  text not null default 'saying' check (genre in ('saying', 'biography')),
  text                   text not null check (length(btrim(text)) >= 10),
  book                   text not null,
  volume                 integer check (volume is null or volume > 0),
  page                   integer check (page is null or page > 0),
  source_url             text,
  tags                   text[] not null default '{}',
  needs_reference_check  boolean not null default true,
  status                 text not null default 'draft' check (status in ('draft', 'published')),
  created_by             uuid references auth.users (id),
  created_at             timestamptz not null default now()
);

create index if not exists quotes_published_idx on public.quotes (status) where status = 'published';
create index if not exists quotes_scholar_idx on public.quotes (scholar_id);

-- ─────────────── ٥) الأحاديث ───────────────
-- مقصورة على الصحيحين، وعلى موضوع فضائل الأعمال.

create table if not exists public.hadiths (
  id                     uuid primary key default gen_random_uuid(),
  collection             text not null check (collection in ('bukhari', 'muslim')),
  text                   text not null check (length(btrim(text)) >= 10),
  narrator               text,
  chapter                text,
  number                 integer check (number is null or number > 0),
  volume                 integer check (volume is null or volume > 0),
  page                   integer check (page is null or page > 0),
  source_id              uuid not null references public.sources (id),
  source_url             text,
  topic                  text not null default 'فضائل الأعمال',
  tags                   text[] not null default '{}',
  needs_reference_check  boolean not null default true,
  status                 text not null default 'draft' check (status in ('draft', 'published')),
  created_by             uuid references auth.users (id),
  created_at             timestamptz not null default now()
);

create unique index if not exists hadiths_collection_number
  on public.hadiths (collection, number) where number is not null;
create index if not exists hadiths_published_idx on public.hadiths (status) where status = 'published';

-- ─────────────── ٥أ) الأدعية ───────────────
-- النوع الثالث. مرجعه **الكتاب ورقم الحديث** لا المجلد والصفحة: مصادره كتب
-- حديثٍ يُحال إليها بأرقامها، فلا يُقيَّد `collection` بالصحيحين كما في الأحاديث.
-- و`sort_order` ترتيب العرض: الأدعية تُعرض مرتّبةً وتُعاد من أوّلها عند تمامها.

create table if not exists public.duas (
  id                     uuid primary key default gen_random_uuid(),
  text                   text not null check (length(btrim(text)) >= 10),
  narrator               text,
  collection             text not null check (length(btrim(collection)) > 0),
  number                 integer check (number is null or number > 0),
  volume                 integer check (volume is null or volume > 0),
  page                   integer check (page is null or page > 0),
  source_id              uuid not null references public.sources (id),
  source_url             text,
  tags                   text[] not null default '{}',
  needs_reference_check  boolean not null default true,
  sort_order             integer not null default 0,
  status                 text not null default 'draft' check (status in ('draft', 'published')),
  created_by             uuid references auth.users (id),
  created_at             timestamptz not null default now(),
  -- لا يُنشر دعاءٌ بلا مرجع: رقمُ حديثٍ أو موضعٌ في الكتاب.
  constraint duas_reference_required check (number is not null or page is not null)
);

create unique index if not exists duas_collection_number
  on public.duas (collection, number) where number is not null;
create index if not exists duas_published_idx on public.duas (status) where status = 'published';
create index if not exists duas_order_idx on public.duas (sort_order);

-- ─────────────── ٦) سياسات RLS ───────────────

alter table public.profiles enable row level security;
alter table public.sources  enable row level security;
alter table public.scholars enable row level security;
alter table public.quotes   enable row level security;
alter table public.hadiths  enable row level security;
alter table public.duas     enable row level security;

-- الملفات الشخصية: كل مستخدم يقرأ ملفه فقط. الدور لا يُعدَّل من التطبيق إطلاقاً.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id or public.is_admin());

-- القراءة العامة: المنشور والمفعّل فقط، حتى بلا تسجيل دخول.
drop policy if exists sources_read on public.sources;
create policy sources_read on public.sources
  for select using (is_active or public.is_admin());

drop policy if exists scholars_read on public.scholars;
create policy scholars_read on public.scholars
  for select using (is_active or public.is_admin());

drop policy if exists quotes_read on public.quotes;
create policy quotes_read on public.quotes
  for select using (status = 'published' or public.is_admin());

drop policy if exists hadiths_read on public.hadiths;
create policy hadiths_read on public.hadiths
  for select using (status = 'published' or public.is_admin());

drop policy if exists duas_read on public.duas;
create policy duas_read on public.duas
  for select using (status = 'published' or public.is_admin());

-- الكتابة: الأدمن وحده، في كل الجداول.
do $$
declare t text;
begin
  foreach t in array array['sources', 'scholars', 'quotes', 'hadiths', 'duas'] loop
    execute format('drop policy if exists %1$s_admin_insert on public.%1$s', t);
    execute format(
      'create policy %1$s_admin_insert on public.%1$s for insert to authenticated with check (public.is_admin())', t);

    execute format('drop policy if exists %1$s_admin_update on public.%1$s', t);
    execute format(
      'create policy %1$s_admin_update on public.%1$s for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);

    execute format('drop policy if exists %1$s_admin_delete on public.%1$s', t);
    execute format(
      'create policy %1$s_admin_delete on public.%1$s for delete to authenticated using (public.is_admin())', t);
  end loop;
end;
$$;

-- حارس إضافي: المصدر المدمج (تراث) لا يُحذف ولا تُغيَّر هويته.
create or replace function public.protect_builtin_source()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.is_builtin then
    raise exception 'لا يمكن حذف مصدر مدمج';
  end if;
  if tg_op = 'UPDATE' and old.is_builtin and (new.slug <> old.slug or new.kind <> old.kind) then
    raise exception 'لا يمكن تغيير هوية المصدر المدمج';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists sources_protect_builtin on public.sources;
create trigger sources_protect_builtin
  before update or delete on public.sources
  for each row execute function public.protect_builtin_source();

-- تعبئة created_by تلقائياً.
create or replace function public.set_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['sources', 'scholars', 'quotes', 'hadiths', 'duas'] loop
    execute format('drop trigger if exists %1$s_set_created_by on public.%1$s', t);
    execute format(
      'create trigger %1$s_set_created_by before insert on public.%1$s for each row execute function public.set_created_by()', t);
  end loop;
end;
$$;

-- ════════════════════════════════════════════════════════════════
--  بعد التنفيذ:
--   ١) أنشئ حسابك من Authentication → Users → Add user.
--   ٢) رقّه إلى أدمن:
--        update public.profiles set role = 'admin'
--        where email = 'your@email.com';
--   ٣) نفّذ seed.sql لتعبئة المصدر والعالم والمحتوى الأولي.
-- ════════════════════════════════════════════════════════════════
