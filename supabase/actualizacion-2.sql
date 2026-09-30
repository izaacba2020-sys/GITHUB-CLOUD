-- Actualización 2: fotos mensuales de la cartera para las estadísticas (evolución año con año).
-- Pegar completo en Supabase > SQL Editor > New query > Run (se puede correr más de una vez).

create table if not exists metricas (
  id uuid primary key default gen_random_uuid(),
  perfil text not null check (perfil in ('byc','seguros')),
  periodo text not null,          -- 'AAAA-MM'
  datos jsonb not null,
  created_by text,
  created_at timestamptz default now(),
  unique (perfil, periodo)
);

alter table metricas enable row level security;
drop policy if exists "usuarios autenticados" on metricas;
create policy "usuarios autenticados" on metricas for all to authenticated using (true) with check (true);
