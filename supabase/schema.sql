-- Growy Cloud Sync Schema (Single-Vault JSONB Local-First Architecture)
-- Run this idempotent script in your Supabase Dashboard -> SQL Editor.

create table if not exists public.user_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_vaults enable row level security;

-- Strict per-user Row Level Security policies
drop policy if exists "Users can view their own vault" on public.user_vaults;
create policy "Users can view their own vault"
  on public.user_vaults
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own vault" on public.user_vaults;
create policy "Users can insert their own vault"
  on public.user_vaults
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own vault" on public.user_vaults;
create policy "Users can update their own vault"
  on public.user_vaults
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own vault" on public.user_vaults;
create policy "Users can delete their own vault"
  on public.user_vaults
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Automatic updated_at trigger
create or replace function public.handle_user_vault_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_user_vault_updated on public.user_vaults;
create trigger on_user_vault_updated
  before update on public.user_vaults
  for each row
  execute function public.handle_user_vault_updated_at();

