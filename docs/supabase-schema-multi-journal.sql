-- Folio multi-entry journal migration
-- Supabase SQL Editor에서 1회 실행하세요.

begin;

alter table public.journals
  add column if not exists client_key text;

-- 기존 날짜당 1개 데이터는 날짜를 안정적인 호환 키로 사용한다.
update public.journals
set client_key = date::text
where client_key is null or client_key = '';

alter table public.journals
  alter column client_key set not null;

alter table public.journals
  drop constraint if exists journals_user_id_date_key;

-- 초기 스키마에서 자동 생성된 제약 이름도 동일하지만, 환경별 이름 차이를 안전하게 처리한다.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'journals'
    and con.contype = 'u'
    and pg_get_constraintdef(con.oid) = 'UNIQUE (user_id, date)'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.journals drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.journals
  add constraint journals_user_id_client_key_key unique (user_id, client_key);

create index if not exists journals_client_key_idx
  on public.journals (client_key);

commit;
