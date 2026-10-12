-- Revenu Universel — schéma pédagogique
-- À exécuter dans l'éditeur SQL Supabase ou via CLI.

create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null check (status in ('lobby', 'in_progress', 'finished')),
  current_round integer not null default 0 check (current_round between 0 and 3),
  phase text not null,
  round_started_at timestamptz,
  round_ends_at timestamptz,
  paused_remaining_ms integer,
  votes_revealed boolean not null default false,
  host_token_hash text not null,
  reset_generation integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  nickname text not null,
  initial_balance integer not null default 5 check (initial_balance >= 0),
  current_balance integer not null default 0 check (current_balance >= 0),
  ate_meal boolean,
  is_bot boolean not null default false,
  auth_user_id uuid,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (room_id, nickname)
);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  round_number integer not null check (round_number = 1),
  choice text not null check (choice in ('work', 'leisure', 'training')),
  created_at timestamptz not null default now(),
  unique (participant_id, round_number)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  round_number integer not null check (round_number between 0 and 3),
  amount integer not null,
  reason text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  choice text not null check (choice in ('taxes_all', 'robot_tax', 'wealth_tax')),
  created_at timestamptz not null default now(),
  unique (room_id, participant_id)
);

create index if not exists rooms_code_idx on public.rooms (code);
create index if not exists participants_room_idx on public.participants (room_id);
create index if not exists decisions_room_idx on public.decisions (room_id);
create index if not exists transactions_participant_idx on public.transactions (participant_id);
create index if not exists votes_room_idx on public.votes (room_id);

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.decisions enable row level security;
alter table public.transactions enable row level security;
alter table public.votes enable row level security;

-- Lecture : toute personne connaissant le code peut observer la salle.
-- Les mutations financières et d'état passent par les routes API (service role).

drop policy if exists "rooms_select" on public.rooms;
create policy "rooms_select" on public.rooms
  for select using (true);

drop policy if exists "participants_select" on public.participants;
create policy "participants_select" on public.participants
  for select using (true);

drop policy if exists "decisions_select" on public.decisions;
create policy "decisions_select" on public.decisions
  for select using (true);

drop policy if exists "transactions_select" on public.transactions;
create policy "transactions_select" on public.transactions
  for select using (true);

drop policy if exists "votes_select_hidden" on public.votes;
create policy "votes_select_hidden" on public.votes
  for select using (
    exists (
      select 1 from public.rooms r
      where r.id = votes.room_id and r.votes_revealed = true
    )
  );

-- Les participants authentifiés anonymement ne peuvent insérer que leur propre vote/choix
-- via RPC sécurisées. Les politiques d'écriture directe sont volontairement absentes.

create or replace function public.touch_participant(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.participants
  set connected_at = now()
  where id = p_id;
$$;

revoke all on function public.touch_participant(uuid) from public;
grant execute on function public.touch_participant(uuid) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.participants;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.decisions;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.transactions;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.votes;
exception when duplicate_object then null;
end $$;
