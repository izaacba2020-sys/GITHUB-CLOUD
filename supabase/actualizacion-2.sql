-- Actualización 2: fotos mensuales de la cartera (estadísticas) y modalidad de pago de las pólizas.
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

-- Modalidad de pago (Visa cuotas, pronto pago, fraccionado, débito a cuenta)
alter table polizas add column if not exists modalidad_pago text;

-- Forma de pago anterior -> número de pagos
update polizas set forma_pago = case forma_pago
  when 'Anual' then '1 pago' when 'Semestral' then '2 pagos'
  when 'Trimestral' then '4 pagos' when 'Mensual' then '12 pagos' else forma_pago end
where forma_pago in ('Anual', 'Semestral', 'Trimestral', 'Mensual');
