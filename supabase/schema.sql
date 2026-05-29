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

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardians_email_unique unique (email)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid references public.guardians(id) on delete set null,
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

alter table public.students
add column if not exists guardian_id uuid references public.guardians(id) on delete set null;

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
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
  student_id uuid references public.students(id) on delete set null,
  payer_guardian_id uuid references public.guardians(id) on delete set null,
  reference_month date not null,
  paid_at date not null default current_date,
  amount numeric(10,2) not null check (amount >= 0),
  method public.payment_method not null default 'pix',
  registered_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_reference_month_first_day check (reference_month = date_trunc('month', reference_month)::date)
);

alter table public.payments
add column if not exists payer_guardian_id uuid references public.guardians(id) on delete set null;

alter table public.payments
alter column student_id drop not null;

alter table public.payments
drop constraint if exists payments_student_month_unique;

alter table public.payments
drop constraint if exists payments_student_id_fkey;

alter table public.payments
add constraint payments_student_id_fkey
foreign key (student_id) references public.students(id) on delete set null;

alter table public.payments
drop constraint if exists payments_registered_by_fkey;

alter table public.payments
add constraint payments_registered_by_fkey
foreign key (registered_by) references public.profiles(id) on delete restrict;

create table if not exists public.payment_items (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  reference_month date not null,
  amount numeric(10,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_items_reference_month_first_day check (reference_month = date_trunc('month', reference_month)::date),
  constraint payment_items_enrollment_month_unique unique (enrollment_id, reference_month)
);

create table if not exists public.payment_statuses (
  enrollment_id uuid references public.student_enrollments(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  reference_month date not null,
  payment_id uuid not null references public.payments(id) on delete cascade,
  paid_at date not null,
  registered_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (enrollment_id, reference_month)
);

alter table public.payment_statuses
add column if not exists enrollment_id uuid references public.student_enrollments(id) on delete cascade;

alter table public.payment_statuses
drop constraint if exists payment_statuses_registered_by_fkey;

alter table public.payment_statuses
add constraint payment_statuses_registered_by_fkey
foreign key (registered_by) references public.profiles(id) on delete set null;

create index if not exists guardians_email_idx on public.guardians(email);
create index if not exists students_guardian_idx on public.students(guardian_id);
create index if not exists students_modality_idx on public.students(modality_id);
create index if not exists enrollments_student_idx on public.student_enrollments(student_id);
create index if not exists enrollments_modality_idx on public.student_enrollments(modality_id);
create index if not exists payments_reference_month_idx on public.payments(reference_month);
create index if not exists payments_paid_at_idx on public.payments(paid_at);
create index if not exists payments_payer_guardian_idx on public.payments(payer_guardian_id);
create index if not exists payment_items_payment_idx on public.payment_items(payment_id);
create index if not exists payment_items_enrollment_idx on public.payment_items(enrollment_id);
create index if not exists payment_statuses_reference_month_idx on public.payment_statuses(reference_month);

insert into public.modalities (name, default_monthly_value)
values
  ('Piano', 180),
  ('Violao', 150),
  ('Bateria', 170),
  ('Canto', 160),
  ('Pintura', 140),
  ('Sem modalidade', 0)
on conflict (name) do nothing;

insert into public.student_enrollments (
  student_id,
  modality_id,
  monthly_value,
  due_day,
  status,
  notes,
  created_at,
  updated_at
)
select
  s.id,
  coalesce(
    s.modality_id,
    (select id from public.modalities where name = 'Sem modalidade' limit 1)
  ),
  s.monthly_value,
  s.due_day,
  s.status,
  s.notes,
  s.created_at,
  s.updated_at
from public.students as s
where not exists (
  select 1
  from public.student_enrollments as se
  where se.student_id = s.id
);

update public.payments as p
set payer_guardian_id = s.guardian_id
from public.students as s
where p.student_id = s.id
  and p.payer_guardian_id is null;

insert into public.payment_items (
  payment_id,
  enrollment_id,
  reference_month,
  amount,
  created_at,
  updated_at
)
select
  p.id,
  se.id,
  p.reference_month,
  p.amount,
  p.created_at,
  p.updated_at
from public.payments as p
join lateral (
  select id
  from public.student_enrollments
  where student_id = p.student_id
  order by created_at
  limit 1
) as se on true
where p.student_id is not null
on conflict (enrollment_id, reference_month) do nothing;

update public.payment_statuses as ps
set enrollment_id = se.id
from public.student_enrollments as se
where ps.enrollment_id is null
  and ps.student_id = se.student_id;

delete from public.payment_statuses
where enrollment_id is null;

alter table public.payment_statuses
alter column enrollment_id set not null;

alter table public.payment_statuses
alter column student_id set not null;

alter table public.payment_statuses
drop constraint if exists payment_statuses_pkey;

alter table public.payment_statuses
add constraint payment_statuses_pkey primary key (enrollment_id, reference_month);

insert into public.payment_statuses (
  enrollment_id,
  student_id,
  reference_month,
  payment_id,
  paid_at,
  registered_by,
  created_at
)
select
  pi.enrollment_id,
  se.student_id,
  pi.reference_month,
  pi.payment_id,
  p.paid_at,
  p.registered_by,
  p.created_at
from public.payment_items as pi
join public.student_enrollments as se on se.id = pi.enrollment_id
join public.payments as p on p.id = pi.payment_id
on conflict (enrollment_id, reference_month)
do update set
  student_id = excluded.student_id,
  payment_id = excluded.payment_id,
  paid_at = excluded.paid_at,
  registered_by = excluded.registered_by;

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

create or replace function app_private.sync_payment_status_from_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row record;
  enrollment_row record;
begin
  if tg_op = 'DELETE' then
    delete from public.payment_statuses
    where enrollment_id = old.enrollment_id
      and reference_month = old.reference_month
      and payment_id = old.payment_id;

    return old;
  end if;

  if tg_op = 'UPDATE'
    and (
      old.payment_id <> new.payment_id
      or old.enrollment_id <> new.enrollment_id
      or old.reference_month <> new.reference_month
    )
  then
    delete from public.payment_statuses
    where enrollment_id = old.enrollment_id
      and reference_month = old.reference_month
      and payment_id = old.payment_id;
  end if;

  select paid_at, registered_by
  into payment_row
  from public.payments
  where id = new.payment_id;

  select student_id
  into enrollment_row
  from public.student_enrollments
  where id = new.enrollment_id;

  insert into public.payment_statuses (
    enrollment_id,
    student_id,
    reference_month,
    payment_id,
    paid_at,
    registered_by
  )
  values (
    new.enrollment_id,
    enrollment_row.student_id,
    new.reference_month,
    new.payment_id,
    payment_row.paid_at,
    payment_row.registered_by
  )
  on conflict (enrollment_id, reference_month)
  do update set
    student_id = excluded.student_id,
    payment_id = excluded.payment_id,
    paid_at = excluded.paid_at,
    registered_by = excluded.registered_by;

  return new;
end;
$$;

create or replace function app_private.sync_payment_status_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payment_statuses
  set
    paid_at = new.paid_at,
    registered_by = new.registered_by
  where payment_id = new.id;

  return new;
end;
$$;

create or replace function public.record_payment(
  p_reference_month date,
  p_paid_at date,
  p_amount numeric,
  p_method public.payment_method,
  p_note text,
  p_payer_guardian_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  item_count integer;
  new_payment_id uuid;
  selected_enrollment_id uuid;
  selected_amount numeric(10,2);
  primary_student_id uuid;
begin
  if not app_private.is_staff_or_admin() then
    raise exception 'Apenas funcionarios podem lancar pagamentos.' using errcode = '42501';
  end if;

  if p_reference_month <> date_trunc('month', p_reference_month)::date then
    raise exception 'O mes de referencia precisa ser o primeiro dia do mes.' using errcode = '22007';
  end if;

  if p_amount < 0 then
    raise exception 'O valor do pagamento nao pode ser negativo.' using errcode = '22003';
  end if;

  item_count := coalesce(jsonb_array_length(p_items), 0);

  if item_count = 0 then
    raise exception 'Selecione pelo menos uma matricula para dar baixa.' using errcode = '22023';
  end if;

  select se.student_id
  into primary_student_id
  from jsonb_array_elements(p_items) as payload(item)
  join public.student_enrollments as se on se.id = (payload.item->>'enrollment_id')::uuid
  order by se.created_at
  limit 1;

  insert into public.payments (
    student_id,
    payer_guardian_id,
    reference_month,
    paid_at,
    amount,
    method,
    registered_by,
    note
  )
  values (
    primary_student_id,
    p_payer_guardian_id,
    p_reference_month,
    p_paid_at,
    p_amount,
    p_method,
    auth.uid(),
    nullif(trim(p_note), '')
  )
  returning id into new_payment_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    selected_enrollment_id := (item->>'enrollment_id')::uuid;
    selected_amount := (item->>'amount')::numeric;

    if selected_amount < 0 then
      raise exception 'O valor de uma modalidade nao pode ser negativo.' using errcode = '22003';
    end if;

    if not exists (
      select 1
      from public.student_enrollments
      where id = selected_enrollment_id
        and status = 'active'
    ) then
      raise exception 'Uma das matriculas selecionadas nao esta ativa.' using errcode = '22023';
    end if;

    insert into public.payment_items (
      payment_id,
      enrollment_id,
      reference_month,
      amount
    )
    values (
      new_payment_id,
      selected_enrollment_id,
      p_reference_month,
      selected_amount
    );
  end loop;

  return new_payment_id;
exception
  when unique_violation then
    raise exception 'Uma das modalidades selecionadas ja tem pagamento lancado nesse mes.' using errcode = '23505';
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

drop trigger if exists guardians_updated_at on public.guardians;
create trigger guardians_updated_at
before update on public.guardians
for each row execute function app_private.set_updated_at();

drop trigger if exists students_updated_at on public.students;
create trigger students_updated_at
before update on public.students
for each row execute function app_private.set_updated_at();

drop trigger if exists student_enrollments_updated_at on public.student_enrollments;
create trigger student_enrollments_updated_at
before update on public.student_enrollments
for each row execute function app_private.set_updated_at();

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at
before update on public.payments
for each row execute function app_private.set_updated_at();

drop trigger if exists payment_items_updated_at on public.payment_items;
create trigger payment_items_updated_at
before update on public.payment_items
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

drop trigger if exists payment_items_sync_status on public.payment_items;
create trigger payment_items_sync_status
after insert or update or delete on public.payment_items
for each row execute function app_private.sync_payment_status_from_item();

drop trigger if exists payments_sync_status_from_payment on public.payments;
create trigger payments_sync_status_from_payment
after update of paid_at, registered_by on public.payments
for each row execute function app_private.sync_payment_status_from_payment();

alter table public.profiles enable row level security;
alter table public.modalities enable row level security;
alter table public.guardians enable row level security;
alter table public.students enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.payments enable row level security;
alter table public.payment_items enable row level security;
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

drop policy if exists "Staff can read guardians" on public.guardians;
create policy "Staff can read guardians"
on public.guardians
for select
to authenticated
using (public.is_staff_or_admin());

drop policy if exists "Staff can create guardians" on public.guardians;
create policy "Staff can create guardians"
on public.guardians
for insert
to authenticated
with check (public.is_staff_or_admin());

drop policy if exists "Staff can update guardians" on public.guardians;
create policy "Staff can update guardians"
on public.guardians
for update
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

drop policy if exists "Admins can delete guardians" on public.guardians;
create policy "Admins can delete guardians"
on public.guardians
for delete
to authenticated
using (public.is_admin());

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

drop policy if exists "Staff can read enrollments" on public.student_enrollments;
create policy "Staff can read enrollments"
on public.student_enrollments
for select
to authenticated
using (public.is_staff_or_admin());

drop policy if exists "Staff can create enrollments" on public.student_enrollments;
create policy "Staff can create enrollments"
on public.student_enrollments
for insert
to authenticated
with check (public.is_staff_or_admin());

drop policy if exists "Staff can update enrollments" on public.student_enrollments;
create policy "Staff can update enrollments"
on public.student_enrollments
for update
to authenticated
using (public.is_staff_or_admin())
with check (public.is_staff_or_admin());

drop policy if exists "Admins can delete enrollments" on public.student_enrollments;
create policy "Admins can delete enrollments"
on public.student_enrollments
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

drop policy if exists "Admins can read payment items" on public.payment_items;
create policy "Admins can read payment items"
on public.payment_items
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can update payment items" on public.payment_items;
create policy "Admins can update payment items"
on public.payment_items
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete payment items" on public.payment_items;
create policy "Admins can delete payment items"
on public.payment_items
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Staff can read payment statuses" on public.payment_statuses;
create policy "Staff can read payment statuses"
on public.payment_statuses
for select
to authenticated
using (public.is_staff_or_admin());

grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.modalities to authenticated;
grant insert, update, delete on public.modalities to authenticated;
grant select, insert, update, delete on public.guardians to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.student_enrollments to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.payment_items to authenticated;
grant select on public.payment_statuses to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff_or_admin() to authenticated;
grant execute on function public.record_payment(date, date, numeric, public.payment_method, text, uuid, jsonb) to authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_admin() to authenticated;
grant execute on function app_private.is_staff_or_admin() to authenticated;
