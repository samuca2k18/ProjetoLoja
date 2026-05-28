create extension if not exists pgcrypto;

create schema if not exists app_private;

do $$
begin
  create type public.app_role as enum ('admin', 'staff');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.student_status as enum ('active', 'paused', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_method as enum ('pix', 'cash', 'card', 'transfer');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists email text;

create table if not exists public.modalities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_monthly_value numeric(10,2) not null default 0 check (default_monthly_value >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  modality_id uuid references public.modalities(id) on delete set null,
  monthly_value numeric(10,2) not null default 0 check (monthly_value >= 0),
  due_day integer not null default 10 check (due_day between 1 and 31),
  status public.student_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  reference_month date not null,
  paid_at date not null default current_date,
  amount numeric(10,2) not null check (amount >= 0),
  method public.payment_method not null default 'pix',
  registered_by uuid not null default auth.uid() references auth.users(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_reference_month_first_day check (reference_month = date_trunc('month', reference_month)::date),
  constraint payments_student_month_unique unique (student_id, reference_month)
);

create table if not exists public.payment_statuses (
  student_id uuid not null references public.students(id) on delete cascade,
  reference_month date not null,
  payment_id uuid not null references public.payments(id) on delete cascade,
  paid_at date not null,
  registered_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (student_id, reference_month)
);

create index if not exists students_modality_idx on public.students(modality_id);
create index if not exists payments_reference_month_idx on public.payments(reference_month);
create index if not exists payments_paid_at_idx on public.payments(paid_at);
create index if not exists payment_statuses_reference_month_idx on public.payment_statuses(reference_month);

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function app_private.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'staff')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select app_private.is_admin();
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
as $$
  select app_private.is_staff_or_admin();
$$;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do update set
    email = excluded.email,
    full_name = case
      when public.profiles.full_name = '' then excluded.full_name
      else public.profiles.full_name
    end;

  return new;
end;
$$;

create or replace function app_private.sync_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.payment_statuses
    where payment_id = old.id;

    return old;
  end if;

  if tg_op = 'UPDATE'
    and (
      old.student_id <> new.student_id
      or old.reference_month <> new.reference_month
    )
  then
    delete from public.payment_statuses
    where payment_id = old.id;
  end if;

  insert into public.payment_statuses (
    student_id,
    reference_month,
    payment_id,
    paid_at,
    registered_by
  )
  values (
    new.student_id,
    new.reference_month,
    new.id,
    new.paid_at,
    new.registered_by
  )
  on conflict (student_id, reference_month)
  do update set
    payment_id = excluded.payment_id,
    paid_at = excluded.paid_at,
    registered_by = excluded.registered_by;

  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function app_private.set_updated_at();

drop trigger if exists modalities_updated_at on public.modalities;
create trigger modalities_updated_at
before update on public.modalities
for each row execute function app_private.set_updated_at();

drop trigger if exists students_updated_at on public.students;
create trigger students_updated_at
before update on public.students
for each row execute function app_private.set_updated_at();

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at
before update on public.payments
for each row execute function app_private.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function app_private.handle_new_user();

update public.profiles as p
set email = u.email
from auth.users as u
where p.id = u.id
  and p.email is null;

drop trigger if exists payments_sync_status on public.payments;
create trigger payments_sync_status
after insert or update or delete on public.payments
for each row execute function app_private.sync_payment_status();

alter table public.profiles enable row level security;
alter table public.modalities enable row level security;
alter table public.students enable row level security;
alter table public.payments enable row level security;
alter table public.payment_statuses enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Staff can read modalities" on public.modalities;
create policy "Staff can read modalities"
on public.modalities
for select
to authenticated
using (public.is_staff_or_admin());

drop policy if exists "Admins can manage modalities" on public.modalities;
create policy "Admins can manage modalities"
on public.modalities
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Staff can read students" on public.students;
create policy "Staff can read students"
on public.students
for select
to authenticated
using (public.is_staff_or_admin());

drop policy if exists "Staff can create students" on public.students;
create policy "Staff can create students"
on public.students
for insert
to authenticated
with check (public.is_staff_or_admin());

drop policy if exists "Staff can update students" on public.students;
create policy "Staff can update students"
on public.students
for update
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

drop policy if exists "Admins can delete students" on public.students;
create policy "Admins can delete students"
on public.students
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Admins can read payments" on public.payments;
create policy "Admins can read payments"
on public.payments
for select
to authenticated
using (public.is_admin());

drop policy if exists "Staff can insert payments" on public.payments;
create policy "Staff can insert payments"
on public.payments
for insert
to authenticated
with check (
  public.is_staff_or_admin()
  and registered_by = (select auth.uid())
);

drop policy if exists "Admins can update payments" on public.payments;
create policy "Admins can update payments"
on public.payments
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete payments" on public.payments;
create policy "Admins can delete payments"
on public.payments
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Staff can read payment statuses" on public.payment_statuses;
create policy "Staff can read payment statuses"
on public.payment_statuses
for select
to authenticated
using (public.is_staff_or_admin());

insert into public.modalities (name, default_monthly_value)
values
  ('Piano', 180),
  ('Violão', 150),
  ('Bateria', 170),
  ('Canto', 160),
  ('Pintura', 140)
on conflict (name) do nothing;

grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.modalities to authenticated;
grant insert, update, delete on public.modalities to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select on public.payment_statuses to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff_or_admin() to authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_admin() to authenticated;
grant execute on function app_private.is_staff_or_admin() to authenticated;
