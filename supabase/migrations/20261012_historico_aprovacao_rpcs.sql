-- =====================================================================
-- 2026-10-12  Histórico preservado, aprovação de contas e RPCs seguras
-- Idempotente: pode rodar mais de uma vez. Não apaga nenhum dado.
-- Rode no Supabase > SQL Editor (ou `npm run db:apply`, que inclui isto
-- no schema.sql).
-- =====================================================================

-- 1) Aprovação de contas novas -----------------------------------------
alter table public.profiles add column if not exists approved boolean;
-- Quem já existe continua com acesso.
update public.profiles set approved = true where approved is null;
alter table public.profiles alter column approved set default false;
alter table public.profiles alter column approved set not null;

create or replace function app_private.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and approved
  );
$$;

create or replace function app_private.is_staff_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'staff') and approved
  );
$$;

-- Conta nova entra como funcionário NÃO aprovado (sem acesso a dados).
create or replace function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, approved)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), 'staff', false)
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when public.profiles.full_name = '' then excluded.full_name
                     else public.profiles.full_name end;
  return new;
end;
$$;

-- Admin não pode tirar o próprio acesso nem o próprio papel de admin.
create or replace function app_private.protect_own_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id = (select auth.uid())
     and (new.approved is distinct from old.approved or new.role is distinct from old.role) then
    raise exception 'Você não pode alterar o seu próprio acesso.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_own on public.profiles;
create trigger profiles_protect_own before update on public.profiles
for each row execute function app_private.protect_own_profile();

-- 2) Exclusão de aluno sem perder histórico -----------------------------
alter table public.students add column if not exists deleted_at timestamptz;
alter table public.students add column if not exists deleted_by uuid references public.profiles(id) on delete set null;
alter table public.student_enrollments add column if not exists archived_at timestamptz;
create index if not exists students_deleted_at_idx on public.students(deleted_at);
create index if not exists students_deleted_by_idx on public.students(deleted_by);

-- Foto (snapshot) do aluno/modalidade em cada item pago e do pagador.
alter table public.payment_items add column if not exists student_id uuid references public.students(id) on delete set null;
alter table public.payment_items add column if not exists student_name text;
alter table public.payment_items add column if not exists modality_id uuid references public.modalities(id) on delete set null;
alter table public.payment_items add column if not exists modality_name text;
alter table public.payments add column if not exists payer_name text;
create index if not exists payment_items_student_idx on public.payment_items(student_id);
create index if not exists payment_items_modality_idx on public.payment_items(modality_id);

update public.payment_items as pi
set student_id = se.student_id,
    student_name = s.full_name,
    modality_id = se.modality_id,
    modality_name = m.name
from public.student_enrollments as se
join public.students as s on s.id = se.student_id
left join public.modalities as m on m.id = se.modality_id
where se.id = pi.enrollment_id
  and pi.student_name is null;

update public.payments as p
set payer_name = g.full_name
from public.guardians as g
where g.id = p.payer_guardian_id
  and p.payer_name is null;

-- Se uma matrícula for apagada de verdade (ex.: pelo painel), o item pago fica.
alter table public.payment_items alter column enrollment_id drop not null;
alter table public.payment_items drop constraint if exists payment_items_enrollment_id_fkey;
alter table public.payment_items add constraint payment_items_enrollment_id_fkey
  foreign key (enrollment_id) references public.student_enrollments(id) on delete set null;

create or replace function app_private.fill_payment_item_snapshot()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.enrollment_id is not null and (new.student_name is null or new.modality_name is null) then
    select se.student_id, s.full_name, se.modality_id, m.name
    into new.student_id, new.student_name, new.modality_id, new.modality_name
    from public.student_enrollments se
    join public.students s on s.id = se.student_id
    left join public.modalities m on m.id = se.modality_id
    where se.id = new.enrollment_id;
  end if;
  return new;
end;
$$;
drop trigger if exists payment_items_snapshot on public.payment_items;
create trigger payment_items_snapshot before insert on public.payment_items
for each row execute function app_private.fill_payment_item_snapshot();

create or replace function app_private.sync_payment_status_from_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  payment_row record;
  enrollment_row record;
begin
  if tg_op in ('DELETE', 'UPDATE') and old.enrollment_id is not null then
    if tg_op = 'DELETE'
       or new.enrollment_id is null
       or old.payment_id <> new.payment_id
       or old.enrollment_id <> new.enrollment_id
       or old.reference_month <> new.reference_month then
      delete from public.payment_statuses
      where enrollment_id = old.enrollment_id
        and reference_month = old.reference_month
        and payment_id = old.payment_id;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  if new.enrollment_id is null then return new; end if;
  if tg_op = 'UPDATE'
     and old.payment_id = new.payment_id
     and old.enrollment_id is not distinct from new.enrollment_id
     and old.reference_month = new.reference_month then
    return new;
  end if;

  select paid_at, registered_by into payment_row from public.payments where id = new.payment_id;
  select student_id into enrollment_row from public.student_enrollments where id = new.enrollment_id;
  if enrollment_row.student_id is null then return new; end if;

  insert into public.payment_statuses (enrollment_id, student_id, reference_month, payment_id, paid_at, registered_by)
  values (new.enrollment_id, enrollment_row.student_id, new.reference_month, new.payment_id,
          payment_row.paid_at, payment_row.registered_by)
  on conflict (enrollment_id, reference_month) do update set
    student_id = excluded.student_id,
    payment_id = excluded.payment_id,
    paid_at = excluded.paid_at,
    registered_by = excluded.registered_by;
  return new;
end;
$$;

-- Ninguém apaga aluno/matrícula de verdade pelo app: só arquiva.
drop policy if exists "Admins can delete students" on public.students;
drop policy if exists "Staff can delete students" on public.students;
drop policy if exists "Admins can delete enrollments" on public.student_enrollments;
drop policy if exists "Staff can delete enrollments" on public.student_enrollments;
revoke delete on public.students from authenticated;
revoke delete on public.student_enrollments from authenticated;

create or replace function public.archive_student(p_student_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not app_private.is_staff_or_admin() then
    raise exception 'Apenas funcionários aprovados podem excluir alunos.' using errcode = '42501';
  end if;

  update public.students
  set deleted_at = now(), deleted_by = (select auth.uid())
  where id = p_student_id and deleted_at is null;

  if not found then
    raise exception 'Aluno não encontrado ou já excluído.' using errcode = 'P0002';
  end if;

  update public.student_enrollments
  set status = 'cancelled', archived_at = coalesce(archived_at, now())
  where student_id = p_student_id;
end;
$$;

-- 3) record_payment com validações no servidor --------------------------
create or replace function public.record_payment(
  p_reference_month date,
  p_paid_at date,
  p_amount numeric,
  p_method public.payment_method,
  p_note text,
  p_payer_guardian_id uuid,
  p_items jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  item_count integer;
  distinct_count integer;
  family_count integer;
  items_total numeric(10,2);
  expected_total numeric(10,2);
  has_bad_amount boolean;
  new_payment_id uuid;
  primary_student_id uuid;
  family_guardian uuid;
  clean_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not app_private.is_staff_or_admin() then
    raise exception 'Apenas funcionários aprovados podem lançar pagamentos.' using errcode = '42501';
  end if;
  if p_reference_month is null or p_reference_month <> date_trunc('month', p_reference_month)::date then
    raise exception 'O mês de referência precisa ser o primeiro dia do mês.' using errcode = '22007';
  end if;
  if p_paid_at is null then
    raise exception 'Informe a data do pagamento.' using errcode = '22004';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'O valor do pagamento não pode ser negativo.' using errcode = '22003';
  end if;

  item_count := coalesce(jsonb_array_length(p_items), 0);
  if item_count = 0 then
    raise exception 'Selecione pelo menos uma matrícula para dar baixa.' using errcode = '22023';
  end if;

  select count(distinct x->>'enrollment_id'),
         coalesce(sum((x->>'amount')::numeric), 0),
         bool_or(x->>'amount' is null or (x->>'amount')::numeric < 0)
  into distinct_count, items_total, has_bad_amount
  from jsonb_array_elements(p_items) as x;

  if distinct_count <> item_count then
    raise exception 'A mesma matrícula foi enviada mais de uma vez.' using errcode = '22023';
  end if;
  if has_bad_amount then
    raise exception 'O valor de uma modalidade não pode ser negativo.' using errcode = '22003';
  end if;
  if items_total <> round(p_amount, 2) then
    raise exception 'A soma dos valores por modalidade não confere com o valor total.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as x
    left join public.student_enrollments se on se.id = (x->>'enrollment_id')::uuid
    left join public.students s on s.id = se.student_id
    where se.id is null or se.status <> 'active' or se.archived_at is not null or s.deleted_at is not null
  ) then
    raise exception 'Uma das matrículas selecionadas não está ativa.' using errcode = '22023';
  end if;

  select count(distinct coalesce(s.guardian_id::text, 'aluno:' || s.id::text)),
         sum(se.monthly_value),
         (array_agg(s.guardian_id))[1]
  into family_count, expected_total, family_guardian
  from jsonb_array_elements(p_items) as x
  join public.student_enrollments se on se.id = (x->>'enrollment_id')::uuid
  join public.students s on s.id = se.student_id;

  if family_count > 1 then
    raise exception 'Só dá para dar baixa junta em matrículas da mesma família (mesmo responsável).' using errcode = '22023';
  end if;
  if p_payer_guardian_id is distinct from family_guardian then
    raise exception 'O responsável pagador não corresponde aos alunos selecionados.' using errcode = '22023';
  end if;
  if (p_amount = 0 and expected_total > 0 or p_amount < expected_total) and clean_note is null then
    raise exception 'Valor abaixo da mensalidade: explique na observação (desconto, bolsa, pagamento parcial...).' using errcode = '22023';
  end if;

  select se.student_id into primary_student_id
  from jsonb_array_elements(p_items) as x
  join public.student_enrollments se on se.id = (x->>'enrollment_id')::uuid
  order by se.created_at limit 1;

  insert into public.payments (student_id, payer_guardian_id, payer_name, reference_month, paid_at, amount, method, registered_by, note)
  values (primary_student_id, p_payer_guardian_id,
          (select full_name from public.guardians where id = p_payer_guardian_id),
          p_reference_month, p_paid_at, p_amount, p_method, (select auth.uid()), clean_note)
  returning id into new_payment_id;

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.payment_items (payment_id, enrollment_id, reference_month, amount)
    values (new_payment_id, (item->>'enrollment_id')::uuid, p_reference_month, (item->>'amount')::numeric);
  end loop;

  return new_payment_id;
exception
  when unique_violation then
    raise exception 'Uma das modalidades selecionadas já tem pagamento lançado nesse mês.' using errcode = '23505';
end;
$$;

-- 4) Correção de pagamento numa transação só -----------------------------
create or replace function public.update_payment(
  p_payment_id uuid,
  p_reference_month date,
  p_paid_at date,
  p_amount numeric,
  p_method public.payment_method,
  p_note text,
  p_items jsonb
)
returns void language plpgsql security definer set search_path = public as $$
declare
  clean_note text := nullif(trim(coalesce(p_note, '')), '');
  item_count integer;
  matched_count integer;
  items_total numeric(10,2);
  has_bad_amount boolean;
  existing_count integer;
begin
  if not app_private.is_admin() then
    raise exception 'Apenas administradores podem corrigir pagamentos.' using errcode = '42501';
  end if;
  perform 1 from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Pagamento não encontrado.' using errcode = 'P0002';
  end if;
  if p_reference_month is null or p_reference_month <> date_trunc('month', p_reference_month)::date then
    raise exception 'O mês de referência precisa ser o primeiro dia do mês.' using errcode = '22007';
  end if;
  if p_paid_at is null then
    raise exception 'Informe a data do pagamento.' using errcode = '22004';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'O valor do pagamento não pode ser negativo.' using errcode = '22003';
  end if;
  if p_amount = 0 and clean_note is null then
    raise exception 'Pagamento de R$ 0,00 precisa de uma observação (ex.: bolsa).' using errcode = '22023';
  end if;

  item_count := coalesce(jsonb_array_length(p_items), 0);
  select count(*) into existing_count from public.payment_items where payment_id = p_payment_id;
  select count(pi.id), coalesce(sum((x->>'amount')::numeric), 0),
         bool_or(x->>'amount' is null or (x->>'amount')::numeric < 0)
  into matched_count, items_total, has_bad_amount
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as x
  left join public.payment_items pi on pi.id = (x->>'id')::uuid and pi.payment_id = p_payment_id;

  if item_count <> existing_count or matched_count <> existing_count then
    raise exception 'Os itens enviados não correspondem a esse pagamento.' using errcode = '22023';
  end if;
  if has_bad_amount then
    raise exception 'O valor de uma modalidade não pode ser negativo.' using errcode = '22003';
  end if;
  if items_total <> round(p_amount, 2) then
    raise exception 'A soma dos valores por modalidade não confere com o valor total.' using errcode = '22023';
  end if;

  update public.payments
  set reference_month = p_reference_month, paid_at = p_paid_at, amount = p_amount,
      method = p_method, note = clean_note
  where id = p_payment_id;

  update public.payment_items as pi
  set reference_month = p_reference_month, amount = (x->>'amount')::numeric
  from jsonb_array_elements(p_items) as x
  where pi.id = (x->>'id')::uuid and pi.payment_id = p_payment_id;
exception
  when unique_violation then
    raise exception 'Uma das matrículas já tem pagamento lançado nesse mês.' using errcode = '23505';
end;
$$;

-- Permissões das funções -------------------------------------------------
revoke all on function public.archive_student(uuid) from public, anon;
revoke all on function public.record_payment(date, date, numeric, public.payment_method, text, uuid, jsonb) from public, anon;
revoke all on function public.update_payment(uuid, date, date, numeric, public.payment_method, text, jsonb) from public, anon;
grant execute on function public.archive_student(uuid) to authenticated;
grant execute on function public.record_payment(date, date, numeric, public.payment_method, text, uuid, jsonb) to authenticated;
grant execute on function public.update_payment(uuid, date, date, numeric, public.payment_method, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
