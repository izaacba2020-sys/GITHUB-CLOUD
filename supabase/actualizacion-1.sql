-- Actualización 1: cumpleaños, prima neta, pagos y plantillas de WhatsApp.
-- Pegar completo en Supabase > SQL Editor > New query > Run (se puede correr más de una vez).

alter table clientes add column if not exists fecha_nacimiento date;
alter table polizas add column if not exists prima_neta numeric;

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  perfil text not null check (perfil in ('byc','seguros')),
  ref_tipo text not null check (ref_tipo in ('poliza','expediente')),
  ref_id uuid not null,
  cliente_id uuid references clientes(id) on delete cascade,
  fecha date not null default current_date,
  monto numeric not null,
  metodo text,
  referencia text,
  notas text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists plantillas (
  id uuid primary key default gen_random_uuid(),
  perfil text not null check (perfil in ('byc','seguros')),
  nombre text not null,
  texto text not null,
  created_by text,
  created_at timestamptz default now()
);

do $$
declare t text;
begin
  foreach t in array array['pagos','plantillas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "usuarios autenticados" on %I', t);
    execute format('create policy "usuarios autenticados" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
