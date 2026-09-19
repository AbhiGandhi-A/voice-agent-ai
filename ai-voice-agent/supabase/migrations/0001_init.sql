-- ============================================================================
-- AI Voice Agent — Initial schema, RLS, storage, and realtime configuration
-- Run from the Supabase SQL editor or via `supabase db push`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'supervisor', 'agent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contact_status as enum ('active', 'inactive', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.conversation_type as enum ('web', 'phone');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.conversation_status as enum ('active', 'completed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_sender as enum ('user', 'assistant', 'agent', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_type as enum ('text', 'audio', 'tool_call', 'event');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.call_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.call_status as enum (
    'idle', 'ringing', 'connecting', 'connected', 'ai_active', 'human_active',
    'on_hold', 'transferring', 'ended', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.call_ai_status as enum ('ai_handled', 'human_takeover', 'transferred');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.call_outcome as enum ('resolved', 'escalated', 'follow_up_needed', 'unresolved');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Helper access-control functions (used by RLS policies)
-- ---------------------------------------------------------------------------
create or replace function public.is_supervisor_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('supervisor', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.can_access_conversation(conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.user_id = auth.uid() or public.is_supervisor_or_admin())
  );
$$;

create or replace function public.can_access_call(call_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.calls c
    where c.id = call_id
      and (c.user_id = auth.uid() or public.is_supervisor_or_admin())
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  role public.user_role not null default 'agent',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email, 'agent');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  company text,
  notes text,
  status public.contact_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_phone_idx on public.contacts (phone);
create index if not exists contacts_name_idx on public.contacts (name);
create index if not exists contacts_created_by_idx on public.contacts (created_by);

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  type public.conversation_type not null default 'web',
  status public.conversation_status not null default 'active',
  title text not null default 'New Conversation',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_idx on public.conversations (user_id);
create index if not exists conversations_created_idx on public.conversations (created_at desc);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender public.message_sender not null,
  content text not null,
  message_type public.message_type not null default 'text',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists messages_created_idx on public.messages (created_at);

-- ---------------------------------------------------------------------------
-- calls
-- ---------------------------------------------------------------------------
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  phone_number text not null,
  contact_name text,
  direction public.call_direction not null default 'outbound',
  status public.call_status not null default 'connecting',
  ai_status public.call_ai_status not null default 'ai_handled',
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  provider text not null default 'none',
  provider_call_id text,
  recording_url text,
  transcript_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calls_user_idx on public.calls (user_id, created_at desc);
create index if not exists calls_phone_idx on public.calls (phone_number);
create index if not exists calls_status_idx on public.calls (status);

-- ---------------------------------------------------------------------------
-- call_events
-- ---------------------------------------------------------------------------
create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists call_events_call_idx on public.call_events (call_id, created_at);

-- ---------------------------------------------------------------------------
-- call_summaries
-- ---------------------------------------------------------------------------
create table if not exists public.call_summaries (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null unique references public.calls (id) on delete cascade,
  summary text not null,
  customer_intent text,
  outcome public.call_outcome not null default 'unresolved',
  action_items jsonb,
  sentiment text,
  escalation_required boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- system_settings (per-user app preferences; non-secret values only)
-- ---------------------------------------------------------------------------
create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  category text not null,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, category, key)
);

-- ---------------------------------------------------------------------------
-- integration_settings (non-secret provider display/config)
-- ---------------------------------------------------------------------------
create table if not exists public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  provider text not null,
  category text not null,
  enabled boolean not null default true,
  config jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- ---------------------------------------------------------------------------
-- recordings (metadata only; audio lives in the `call-recordings` bucket)
-- ---------------------------------------------------------------------------
create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls (id) on delete cascade,
  storage_path text not null,
  mime_type text not null default 'audio/wav',
  size_bytes bigint not null default 0,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists recordings_call_idx on public.recordings (call_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.calls enable row level security;
alter table public.call_events enable row level security;
alter table public.call_summaries enable row level security;
alter table public.system_settings enable row level security;
alter table public.integration_settings enable row level security;
alter table public.recordings enable row level security;

-- ---- profiles --------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Prevent users from escalating their own role.
drop policy if exists profiles_update_no_role_escalation on public.profiles;
create policy profiles_update_no_role_escalation on public.profiles
  for update using (id = auth.uid())
  with check (
    auth.uid() <> id
    or (
      (select role from public.profiles p where p.id = id) = role
    )
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid() or public.is_admin());

-- ---- contacts --------------------------------------------------------------
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select using (created_by = auth.uid() or auth.uid() is null or public.is_supervisor_or_admin());

drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts
  for insert with check (created_by = auth.uid() or public.is_admin());

drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts
  for update using (created_by = auth.uid() or public.is_supervisor_or_admin())
  with check (created_by = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts
  for delete using (created_by = auth.uid() or public.is_supervisor_or_admin());

-- ---- conversations ---------------------------------------------------------
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (user_id = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert with check (user_id = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update using (user_id = auth.uid() or public.is_supervisor_or_admin())
  with check (user_id = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists conversations_delete on public.conversations;
create policy conversations_delete on public.conversations
  for delete using (user_id = auth.uid() or public.is_supervisor_or_admin());

-- ---- messages --------------------------------------------------------------
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (public.can_access_conversation(conversation_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (public.can_access_conversation(conversation_id));

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete using (public.can_access_conversation(conversation_id));

-- ---- calls ------------------------------------------------------------------
drop policy if exists calls_select on public.calls;
create policy calls_select on public.calls
  for select using (user_id = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists calls_insert on public.calls;
create policy calls_insert on public.calls
  for insert with check (user_id = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists calls_update on public.calls;
create policy calls_update on public.calls
  for update using (user_id = auth.uid() or public.is_supervisor_or_admin())
  with check (user_id = auth.uid() or public.is_supervisor_or_admin());

drop policy if exists calls_delete on public.calls;
create policy calls_delete on public.calls
  for delete using (user_id = auth.uid() or public.is_supervisor_or_admin());

-- ---- call_events -----------------------------------------------------------
drop policy if exists call_events_select on public.call_events;
create policy call_events_select on public.call_events
  for select using (public.can_access_call(call_id));

drop policy if exists call_events_insert on public.call_events;
create policy call_events_insert on public.call_events
  for insert with check (public.can_access_call(call_id));

-- ---- call_summaries --------------------------------------------------------
drop policy if exists call_summaries_select on public.call_summaries;
create policy call_summaries_select on public.call_summaries
  for select using (public.can_access_call(call_id));

-- ---- system_settings -------------------------------------------------------
drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select on public.system_settings
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists system_settings_upsert on public.system_settings;
create policy system_settings_upsert on public.system_settings
  for insert with check (user_id = auth.uid() or public.is_admin());

drop policy if exists system_settings_update on public.system_settings;
create policy system_settings_update on public.system_settings
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists system_settings_delete on public.system_settings;
create policy system_settings_delete on public.system_settings
  for delete using (user_id = auth.uid() or public.is_admin());

-- ---- integration_settings --------------------------------------------------
drop policy if exists integration_settings_select on public.integration_settings;
create policy integration_settings_select on public.integration_settings
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists integration_settings_upsert on public.integration_settings;
create policy integration_settings_upsert on public.integration_settings
  for insert with check (user_id = auth.uid() or public.is_admin());

drop policy if exists integration_settings_update on public.integration_settings;
create policy integration_settings_update on public.integration_settings
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---- recordings ------------------------------------------------------------
drop policy if exists recordings_select on public.recordings;
create policy recordings_select on public.recordings
  for select using (public.can_access_call(call_id));

drop policy if exists recordings_insert on public.recordings;
create policy recordings_insert on public.recordings
  for insert with check (public.can_access_call(call_id));

-- ============================================================================
-- STORAGE (call-recordings)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('call-recordings', 'call-recordings', false)
on conflict (id) do nothing;

-- Files are stored as <user_id>/<call_id>.<ext> so users can only reach their own.
drop policy if exists call_recordings_select on storage.objects;
create policy call_recordings_select on storage.objects
  for select using (
    bucket_id = 'call-recordings'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_supervisor_or_admin()
    )
  );

drop policy if exists call_recordings_insert on storage.objects;
create policy call_recordings_insert on storage.objects
  for insert with check (
    bucket_id = 'call-recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- REALTIME
-- ============================================================================
drop publication if exists supabase_realtime;
create publication supabase_realtime;

alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.calls;
alter publication supabase_realtime add table public.call_events;
alter publication supabase_realtime add table public.call_summaries;