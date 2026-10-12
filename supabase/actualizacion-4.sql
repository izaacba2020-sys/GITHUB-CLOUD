-- Actualización 4: fecha en que escribió el prospecto, por dónde nos contactó y fecha de cierre.
-- Pegar completo en Supabase > SQL Editor > New query > Run (se puede correr más de una vez).

alter table prospectos add column if not exists fecha_contacto date;
alter table prospectos add column if not exists fuente text;
alter table prospectos add column if not exists fecha_cierre date;

-- A los prospectos que ya existen se les pone como fecha de contacto el día en que se registraron
-- (solo si está vacía; después se puede corregir editando cada prospecto).
update prospectos set fecha_contacto = created_at::date where fecha_contacto is null;
