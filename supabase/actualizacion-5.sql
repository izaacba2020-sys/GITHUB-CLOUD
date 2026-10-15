-- Actualización 5: tarifario de precios de B&C, referidos y comisiones.
-- Pegar completo en Supabase > SQL Editor > New query > Run (se puede correr más de una vez).

create table if not exists tarifas (
  id uuid primary key default gen_random_uuid(),
  perfil text not null check (perfil in ('byc','seguros')),
  nombre text not null,
  tramite text,
  descripcion text,
  honorarios numeric,
  gastos jsonb default '{}'::jsonb,   -- { timbres: { monto, cobrar }, courier: { ... }, ... }
  comision_tipo text default '%',     -- '%' de honorarios o 'Q' monto fijo
  comision_valor numeric,
  dias_estimados numeric,
  activo boolean default true,
  notas text,
  created_by text,
  created_at timestamptz default now()
);
alter table tarifas enable row level security;
drop policy if exists "usuarios autenticados" on tarifas;
create policy "usuarios autenticados" on tarifas for all to authenticated using (true) with check (true);

alter table expedientes add column if not exists tarifa_id uuid references tarifas(id) on delete set null;
alter table expedientes add column if not exists gastos numeric;
alter table expedientes add column if not exists referido_por text;
alter table expedientes add column if not exists comision numeric;
alter table expedientes add column if not exists comision_pagada boolean default false;
alter table expedientes add column if not exists desglose jsonb;

alter table prospectos add column if not exists referido_por text;
alter table prospectos add column if not exists tarifa_id uuid references tarifas(id) on delete set null;
