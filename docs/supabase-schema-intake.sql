-- Folio 통합 수집함: 문서 출처·유형·태그·원본 경로
-- 기존 Supabase 프로젝트의 SQL Editor에서 1회 실행하세요.

alter table public.docs add column if not exists source text;
alter table public.docs add column if not exists note_type text;
alter table public.docs add column if not exists tags text[] not null default '{}';
alter table public.docs add column if not exists source_path text;

alter table public.docs drop constraint if exists docs_source_check;
alter table public.docs add constraint docs_source_check
  check (source is null or source in ('manual', 'hermes'));

alter table public.docs drop constraint if exists docs_note_type_check;
alter table public.docs add constraint docs_note_type_check
  check (note_type is null or note_type in ('doc', 'research', 'meeting', 'knowledge'));

create index if not exists docs_source_idx on public.docs (source);
create index if not exists docs_note_type_idx on public.docs (note_type);
