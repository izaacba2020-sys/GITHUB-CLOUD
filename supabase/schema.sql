-- CRM B&C Abogados y Notarios / Seguros Bobadilla
-- Pegar completo en Supabase > SQL Editor > New query > Run

create extension if not exists "pgcrypto";

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  perfil text not null check (perfil in ('byc','seguros')),
  nombre text not null,
  tipo text,
  dpi text,
  nit text,
  telefono text,
  email text,
  direccion text,
  fuente text,
  etiquetas text,
  fecha_nacimiento date,
  notas text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists prospectos (
  id uuid primary key default gen_random_uuid(),
  perfil text not null check (perfil in ('byc','seguros')),
  titulo text not null,
  cliente_id uuid references clientes(id) on delete set null,
  contacto text,
  telefono text,
  servicio text,
  etapa text default 'Nuevo',
  monto numeric,
  seguimiento date,
  motivo_perdida text,
  notas text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists expedientes (
  id uuid primary key default gen_random_uuid(),
  perfil text not null default 'byc',
  cliente_id uuid references clientes(id) on delete cascade,
  tramite text,
  descripcion text,
  estado text,
  responsable text,
  numero_causa text,
  juzgado text,
  contraparte text,
  fecha_inicio date,
  fecha_limite date,
  honorarios numeric,
  anticipo numeric,
  checklist jsonb default '[]'::jsonb,
  notas text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists polizas (
  id uuid primary key default gen_random_uuid(),
  perfil text not null default 'seguros',
  cliente_id uuid references clientes(id) on delete cascade,
  aseguradora text,
  ramo text,
  numero text,
  suma_asegurada numeric,
  prima_neta numeric,
  prima numeric,
  forma_pago text,
  modalidad_pago text,
  inicio date,
  fin date,
  estado text,
  comision_pct numeric,
  notas text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  perfil text not null check (perfil in ('byc','seguros')),
  titulo text not null,
  tipo text,
  fecha timestamptz,
  cliente_id uuid references clientes(id) on delete cascade,
  expediente_id uuid references expedientes(id) on delete set null,
  hecho boolean default false,
  notas text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists actividad (
  id uuid primary key default gen_random_uuid(),
  perfil text not null,
  usuario text,
  accion text,
  entidad text,
  descripcion text,
  created_at timestamptz default now()
);

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

create table if not exists metricas (
  id uuid primary key default gen_random_uuid(),
  perfil text not null check (perfil in ('byc','seguros')),
  periodo text not null,          -- 'AAAA-MM'
  datos jsonb not null,
  created_by text,
  created_at timestamptz default now(),
  unique (perfil, periodo)
);

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

-- Seguridad: solo usuarios con sesión iniciada pueden leer/escribir.
do $$
declare t text;
begin
  foreach t in array array['clientes','prospectos','expedientes','polizas','tareas','actividad','pagos','plantillas','metricas','bitacora','config'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "usuarios autenticados" on %I', t);
    execute format('create policy "usuarios autenticados" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
