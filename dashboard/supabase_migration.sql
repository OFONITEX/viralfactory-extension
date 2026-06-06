-- Run this in the Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/pescssnflhgodwrdacja/sql

-- 1. Create the profiles table (linked to auth.users)
create table if not exists public.profiles (
  id            uuid references auth.users on delete cascade primary key,
  email         text,
  plan          text not null default 'free' check (plan in ('free','creator','agency')),
  posts_this_month  int not null default 0,
  stripe_customer_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. Auto-create a profile row whenever a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Row-Level Security (users can only read their own row)
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 4. Service-role bypass (for dashboard — uses service key, not publishable key)
-- No extra policy needed; service_role bypasses RLS by default.

-- 5. Expose email in profiles (denormalised for easy dashboard queries)
-- The trigger above handles this on signup.
-- To backfill existing users:
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;
