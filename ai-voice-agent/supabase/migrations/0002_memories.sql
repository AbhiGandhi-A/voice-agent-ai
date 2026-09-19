-- Persistent user memories, isolated by authenticated Supabase user.
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  memory text not null check (char_length(memory) between 1 and 2000),
  category text,
  importance integer not null default 1 check (importance between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memories_user_updated_idx on public.memories (user_id, updated_at desc);
create index if not exists memories_user_importance_idx on public.memories (user_id, importance desc);

alter table public.memories enable row level security;

drop policy if exists memories_select on public.memories;
create policy memories_select on public.memories
  for select using (user_id = auth.uid());

drop policy if exists memories_insert on public.memories;
create policy memories_insert on public.memories
  for insert with check (user_id = auth.uid());

drop policy if exists memories_update on public.memories;
create policy memories_update on public.memories
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists memories_delete on public.memories;
create policy memories_delete on public.memories
  for delete using (user_id = auth.uid());

create or replace function public.set_memories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memories_updated_at on public.memories;
create trigger memories_updated_at
  before update on public.memories
  for each row execute procedure public.set_memories_updated_at();
