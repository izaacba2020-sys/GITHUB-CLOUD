-- Actualización 3: agenda y mejoras de B&C (prospectos, procesos, audiencias, bitácora y configuración).
-- Pegar completo en Supabase > SQL Editor > New query > Run (se puede correr más de una vez).

alter table prospectos add column if not exists motivo_perdida text;

alter table expedientes add column if not exists numero_causa text;
alter table expedientes add column if not exists juzgado text;
alter table expedientes add column if not exists contraparte text;

alter table tareas add column if not exists expediente_id uuid references expedientes(id) on delete set null;

-- Bitácora de cada expediente (notas con fecha)
create table if not exists bitacora (
  id uuid primary key default gen_random_uuid(),
  perfil text not null check (perfil in ('byc','seguros')),
  expediente_id uuid references expedientes(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  fecha date not null default current_date,
  texto text not null,
  created_by text,
  created_at timestamptz default now()
);

-- Configuración (datos para documentos, requisitos por trámite...)
create table if not exists config (
  id uuid primary key default gen_random_uuid(),
  perfil text not null check (perfil in ('byc','seguros')),
  clave text not null,
  valor jsonb,
  created_by text,
  created_at timestamptz default now(),
  unique (perfil, clave)
);

do $$
declare t text;
begin
  foreach t in array array['bitacora','config'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "usuarios autenticados" on %I', t);
    execute format('create policy "usuarios autenticados" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
