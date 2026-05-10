-- ============================================================
-- Vamp - Real-time chord chart sync
-- Run this in your Supabase SQL editor to initialize the DB
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references folders(id) on delete cascade,
  name text not null,
  file_path text not null,
  file_type text not null check (file_type in ('pdf', 'image')),
  created_at timestamptz default now()
);

create table if not exists setlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  folder_id uuid not null references folders(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists setlist_songs (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references setlists(id) on delete cascade,
  song_id uuid not null references songs(id) on delete cascade,
  "order" integer not null default 0
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  code char(6) not null unique,
  current_song_id uuid references songs(id) on delete set null,
  folder_id uuid not null references folders(id) on delete cascade,
  setlist_id uuid references setlists(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  display_name text not null,
  has_control boolean not null default false,
  joined_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists songs_folder_id_idx on songs(folder_id);
create index if not exists setlists_folder_id_idx on setlists(folder_id);
create index if not exists setlist_songs_setlist_id_idx on setlist_songs(setlist_id);
create index if not exists sessions_code_idx on sessions(code);
create index if not exists participants_session_id_idx on participants(session_id);

-- ============================================================
-- ROW LEVEL SECURITY — open access (no auth required)
-- ============================================================

alter table folders enable row level security;
alter table songs enable row level security;
alter table setlists enable row level security;
alter table setlist_songs enable row level security;
alter table sessions enable row level security;
alter table participants enable row level security;

-- Allow full access to all (no-auth app)
create policy "public_all_folders" on folders for all using (true) with check (true);
create policy "public_all_songs" on songs for all using (true) with check (true);
create policy "public_all_setlists" on setlists for all using (true) with check (true);
create policy "public_all_setlist_songs" on setlist_songs for all using (true) with check (true);
create policy "public_all_sessions" on sessions for all using (true) with check (true);
create policy "public_all_participants" on participants for all using (true) with check (true);

-- ============================================================
-- REALTIME — enable for live sync
-- ============================================================

-- Run in the Supabase dashboard: Database > Replication
-- or via SQL:
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table participants;

-- ============================================================
-- STORAGE — charts bucket
-- ============================================================

-- Create the storage bucket (run this or do it via the dashboard)
insert into storage.buckets (id, name, public)
values ('charts', 'charts', true)
on conflict (id) do nothing;

-- Storage policies — open access
create policy "public_charts_select" on storage.objects
  for select using (bucket_id = 'charts');

create policy "public_charts_insert" on storage.objects
  for insert with check (bucket_id = 'charts');

create policy "public_charts_delete" on storage.objects
  for delete using (bucket_id = 'charts');
