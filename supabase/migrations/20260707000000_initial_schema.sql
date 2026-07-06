-- ============================================================================
-- referral-sales-map-ai : schema + RLS (Issue #9)
--
-- IMPORTANT CONTEXT
-- -----------------
-- The target Supabase project (ephyevmcqezodwavuvce) already contains the 16
-- app tables (profiles / contacts / ... / suggestion_approvals) with live
-- rows. Their column layout was introspected via the PostgREST OpenAPI spec
-- on 2026-07-07 and is treated as the canonical schema. This migration is
-- therefore written to be:
--
--   1. Idempotent  : safe to paste into the Supabase SQL Editor repeatedly.
--   2. Additive    : `create table if not exists` reproduces the canonical
--                    schema on a fresh project and is a no-op on the live
--                    project; `add column if not exists` adds only the
--                    columns the mobile app needs that are missing today.
--   3. Scoped      : RLS/grant statements touch ONLY the 16 app tables, so
--                    unrelated tables living in the same project are not
--                    affected.
--
-- HOW TO APPLY
-- ------------
-- Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  role text,
  company_name text,
  onboarding_completed boolean not null default false,
  subscription_status text not null default 'free',
  plan text not null default 'trial',
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user is created,
-- so every authenticated user always has a profiles row (Issue #10 relies
-- on this; the app also upserts client-side as a fallback).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
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

-- Backfill profiles for any pre-existing auth users.
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. contacts
--
-- `id` is a client-generated opaque string. Because the primary key is the
-- global `id` (not (user_id, id)), the app namespaces ids per user as
-- '<user_id>:<client_id>' inside src/storage/personStorage.ts so that two
-- users can never collide on the same client-generated id.
-- ---------------------------------------------------------------------------

create table if not exists public.contacts (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  industry text not null default '',
  role text,
  company text,
  area text,
  relationship text not null default '',
  introduced_by text references public.contacts (id),
  first_contact_date timestamptz,
  last_contact_date timestamptz,
  next_contact_date timestamptz,
  contact_methods jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  current_hypothesis text not null default '',
  current_goal text not null default '',
  current_status text not null default '',
  next_step text not null default '',
  required_actions jsonb not null default '[]'::jsonb,
  caution text not null default '',
  classification jsonb not null default '[]'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columns required by the mobile app's Person model that the pre-existing
-- table does not have yet (additive, no-ops once applied).
alter table public.contacts add column if not exists opening_talk text not null default '';
alter table public.contacts add column if not exists next_question text not null default '';
alter table public.contacts add column if not exists line_message text not null default '';
alter table public.contacts add column if not exists email_message text not null default '';
alter table public.contacts add column if not exists recommended_next_contact_at timestamptz;
alter table public.contacts add column if not exists additional_memo text;
alter table public.contacts add column if not exists notification_id text;
alter table public.contacts add column if not exists archived_at timestamptz;

create index if not exists idx_contacts_user_created
  on public.contacts (user_id, created_at desc);
create index if not exists idx_contacts_user_next_contact
  on public.contacts (user_id, next_contact_date);

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. sales_routes
-- ---------------------------------------------------------------------------

create table if not exists public.sales_routes (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  contact_id text not null references public.contacts (id) on delete cascade,
  route_type text not null,
  title text not null,
  goal text not null default '',
  current_stage text not null default '',
  next_step text not null default '',
  priority text not null default '',
  reason text not null default '',
  status text not null default '',
  confidence numeric not null default 0,
  related_contact_ids jsonb not null default '[]'::jsonb,
  created_by text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_routes_user_contact
  on public.sales_routes (user_id, contact_id);

drop trigger if exists trg_sales_routes_updated_at on public.sales_routes;
create trigger trg_sales_routes_updated_at
  before update on public.sales_routes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. calendar_events
-- ---------------------------------------------------------------------------

create table if not exists public.calendar_events (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  contact_id text not null references public.contacts (id) on delete cascade,
  sales_route_id text references public.sales_routes (id) on delete set null,
  title text not null,
  event_type text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  location text,
  meeting_method text not null default '',
  purpose text not null default '',
  memo text,
  status text not null default '',
  created_by text not null default 'user',
  pre_meeting_nav_id text,
  after_memo_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendar_events_user_start
  on public.calendar_events (user_id, start_at);
create index if not exists idx_calendar_events_user_contact
  on public.calendar_events (user_id, contact_id);

drop trigger if exists trg_calendar_events_updated_at on public.calendar_events;
create trigger trg_calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. action_tasks
-- ---------------------------------------------------------------------------

create table if not exists public.action_tasks (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  contact_id text references public.contacts (id) on delete cascade,
  sales_route_id text references public.sales_routes (id) on delete set null,
  calendar_event_id text references public.calendar_events (id) on delete set null,
  title text not null,
  action_type text not null,
  priority text not null default '',
  reason text not null default '',
  today_goal text not null default '',
  next_step text not null default '',
  target_screen text not null,
  due_date timestamptz not null,
  status text not null,
  created_from text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_action_tasks_user_status
  on public.action_tasks (user_id, status, due_date);
create index if not exists idx_action_tasks_user_contact
  on public.action_tasks (user_id, contact_id);

drop trigger if exists trg_action_tasks_updated_at on public.action_tasks;
create trigger trg_action_tasks_updated_at
  before update on public.action_tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. reminders
-- ---------------------------------------------------------------------------

create table if not exists public.reminders (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  contact_id text references public.contacts (id) on delete cascade,
  sales_route_id text references public.sales_routes (id) on delete set null,
  calendar_event_id text references public.calendar_events (id) on delete set null,
  action_task_id text references public.action_tasks (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  scheduled_at timestamptz not null,
  status text not null default '',
  source_type text not null default '',
  notification_timing text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reminders_user_scheduled
  on public.reminders (user_id, scheduled_at);

drop trigger if exists trg_reminders_updated_at on public.reminders;
create trigger trg_reminders_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. pre_meeting_navs
-- ---------------------------------------------------------------------------

create table if not exists public.pre_meeting_navs (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  contact_id text not null references public.contacts (id) on delete cascade,
  sales_route_id text references public.sales_routes (id) on delete set null,
  calendar_event_id text references public.calendar_events (id) on delete set null,
  action_type text not null default '',
  additional_memo text not null default '',
  purpose text not null default '',
  goal_today text not null default '',
  conversation_policy text not null default '',
  opening_topic text not null default '',
  main_questions jsonb not null default '[]'::jsonb,
  follow_up_questions jsonb not null default '[]'::jsonb,
  ng_actions jsonb not null default '[]'::jsonb,
  should_sell_or_listen text not null default '',
  referral_request_timing text not null default '',
  items_to_record_after jsonb not null default '[]'::jsonb,
  scientific_reason jsonb not null default '[]'::jsonb,
  after_memo_id text,
  status text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pre_meeting_navs_user_contact
  on public.pre_meeting_navs (user_id, contact_id);

drop trigger if exists trg_pre_meeting_navs_updated_at on public.pre_meeting_navs;
create trigger trg_pre_meeting_navs_updated_at
  before update on public.pre_meeting_navs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. after_memos
-- ---------------------------------------------------------------------------

create table if not exists public.after_memos (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  contact_id text not null references public.contacts (id) on delete cascade,
  sales_route_id text references public.sales_routes (id) on delete set null,
  calendar_event_id text references public.calendar_events (id) on delete set null,
  pre_meeting_nav_id text references public.pre_meeting_navs (id) on delete set null,
  contact_type text not null default '',
  question_answers jsonb not null default '[]'::jsonb,
  free_memo text not null default '',
  extracted_info jsonb not null default '{}'::jsonb,
  temperature text not null default '',
  interest_direction text not null default '',
  next_progress text not null default '',
  summary text not null default '',
  update_proposal text not null default '',
  classification_update jsonb not null default '{}'::jsonb,
  goal_update text not null default '',
  next_action text not null default '',
  next_contact_date timestamptz,
  feedback text not null default '',
  next_questions jsonb not null default '[]'::jsonb,
  saved_to_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_after_memos_user_contact
  on public.after_memos (user_id, contact_id);

drop trigger if exists trg_after_memos_updated_at on public.after_memos;
create trigger trg_after_memos_updated_at
  before update on public.after_memos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. message_checks
-- ---------------------------------------------------------------------------

create table if not exists public.message_checks (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  contact_id text not null references public.contacts (id) on delete cascade,
  sales_route_id text references public.sales_routes (id) on delete set null,
  check_type text not null default '',
  input_text text not null default '',
  extracted_info jsonb not null default '{}'::jsonb,
  temperature text not null default '',
  judgement text not null default '',
  reply_policy text not null default '',
  reply_text text not null default '',
  next_question text not null default '',
  contact_update_proposal text not null default '',
  route_update_proposal text not null default '',
  next_action text not null default '',
  next_contact_date timestamptz,
  feedback text not null default '',
  saved_to_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_message_checks_user_contact
  on public.message_checks (user_id, contact_id);

drop trigger if exists trg_message_checks_updated_at on public.message_checks;
create trigger trg_message_checks_updated_at
  before update on public.message_checks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. coach_logs
-- ---------------------------------------------------------------------------

create table if not exists public.coach_logs (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  contact_id text references public.contacts (id) on delete cascade,
  sales_route_id text references public.sales_routes (id) on delete set null,
  related_screen text not null default '',
  question text not null default '',
  context jsonb not null default '{}'::jsonb,
  answer text not null default '',
  advice text not null default '',
  next_action text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coach_logs_user_contact_created
  on public.coach_logs (user_id, contact_id, created_at);

drop trigger if exists trg_coach_logs_updated_at on public.coach_logs;
create trigger trg_coach_logs_updated_at
  before update on public.coach_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 11. update_histories
-- ---------------------------------------------------------------------------

create table if not exists public.update_histories (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  contact_id text references public.contacts (id) on delete cascade,
  sales_route_id text references public.sales_routes (id) on delete set null,
  source_type text not null default '',
  source_id text,
  summary text not null default '',
  updated_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_update_histories_user_contact_created
  on public.update_histories (user_id, contact_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 12. interaction_logs
-- ---------------------------------------------------------------------------

create table if not exists public.interaction_logs (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  contact_id text references public.contacts (id) on delete cascade,
  sales_route_id text references public.sales_routes (id) on delete set null,
  type text not null,
  title text not null,
  summary text not null default '',
  source_type text not null,
  source_id text,
  happened_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_interaction_logs_user_happened
  on public.interaction_logs (user_id, happened_at desc);

-- ---------------------------------------------------------------------------
-- 13. data_gaps
-- ---------------------------------------------------------------------------

create table if not exists public.data_gaps (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  contact_id text references public.contacts (id) on delete cascade,
  sales_route_id text references public.sales_routes (id) on delete set null,
  gap_type text not null,
  title text not null,
  reason text not null default '',
  severity text not null default '',
  target_screen text not null,
  status text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_data_gaps_user_status
  on public.data_gaps (user_id, status);

drop trigger if exists trg_data_gaps_updated_at on public.data_gaps;
create trigger trg_data_gaps_updated_at
  before update on public.data_gaps
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 14. end_of_day_checks
-- ---------------------------------------------------------------------------

create table if not exists public.end_of_day_checks (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  date date not null,
  completed_tasks jsonb not null default '[]'::jsonb,
  incomplete_tasks jsonb not null default '[]'::jsonb,
  completed_events jsonb not null default '[]'::jsonb,
  unresolved_items jsonb not null default '[]'::jsonb,
  contact_updates jsonb not null default '[]'::jsonb,
  data_gap_ids jsonb not null default '[]'::jsonb,
  feedback text not null default '',
  tomorrow_theme text not null default '',
  tomorrow_tasks jsonb not null default '[]'::jsonb,
  status text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_end_of_day_checks_user_date
  on public.end_of_day_checks (user_id, date desc);

drop trigger if exists trg_end_of_day_checks_updated_at on public.end_of_day_checks;
create trigger trg_end_of_day_checks_updated_at
  before update on public.end_of_day_checks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 15. relationship_edges
-- ---------------------------------------------------------------------------

create table if not exists public.relationship_edges (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  from_contact_id text not null references public.contacts (id) on delete cascade,
  to_contact_id text not null references public.contacts (id) on delete cascade,
  relationship_type text not null default '',
  strength text not null default '',
  memo text not null default '',
  created_from text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_relationship_edges_user
  on public.relationship_edges (user_id);

drop trigger if exists trg_relationship_edges_updated_at on public.relationship_edges;
create trigger trg_relationship_edges_updated_at
  before update on public.relationship_edges
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 16. suggestion_approvals
-- ---------------------------------------------------------------------------

create table if not exists public.suggestion_approvals (
  id text primary key,
  user_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  contact_id text references public.contacts (id) on delete cascade,
  sales_route_id text references public.sales_routes (id) on delete set null,
  suggestion_type text not null default '',
  title text not null default '',
  reason text not null default '',
  proposed_action text not null default '',
  proposed_date timestamptz,
  target_screen text not null default '',
  status text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_suggestion_approvals_user_status
  on public.suggestion_approvals (user_id, status);

drop trigger if exists trg_suggestion_approvals_updated_at on public.suggestion_approvals;
create trigger trg_suggestion_approvals_updated_at
  before update on public.suggestion_approvals
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS: enable on the 16 app tables only, owner-only policies for the
-- authenticated role. anon gets no policies and no privileges on app tables,
-- so it cannot read or write app data. Statements are scoped to the 16 app
-- tables so other tables in this shared project are untouched.
-- ============================================================================

-- profiles: a user can see and edit only their own profile row.
alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- The 15 user-owned app tables: owner-only CRUD.
-- with check ((select auth.uid()) = user_id) also rejects NULL user_id and
-- any spoofed user_id on INSERT/UPDATE.
do $$
declare
  t text;
begin
  foreach t in array array[
    'contacts',
    'sales_routes',
    'calendar_events',
    'action_tasks',
    'reminders',
    'pre_meeting_navs',
    'after_memos',
    'message_checks',
    'coach_logs',
    'update_histories',
    'interaction_logs',
    'data_gaps',
    'end_of_day_checks',
    'relationship_edges',
    'suggestion_approvals'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop policy if exists "%s_select_own" on public.%I', t, t);
    execute format(
      'create policy "%s_select_own" on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t, t
    );

    execute format('drop policy if exists "%s_insert_own" on public.%I', t, t);
    execute format(
      'create policy "%s_insert_own" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t, t
    );

    execute format('drop policy if exists "%s_update_own" on public.%I', t, t);
    execute format(
      'create policy "%s_update_own" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t, t
    );

    execute format('drop policy if exists "%s_delete_own" on public.%I', t, t);
    execute format(
      'create policy "%s_delete_own" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t, t
    );
  end loop;
end;
$$;
